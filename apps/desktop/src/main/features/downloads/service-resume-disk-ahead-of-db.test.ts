import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloadRepository } from './repository.js';
import { DownloadService } from './service.js';
import { openInMemoryDb } from './test-helpers.js';
import { insertInterruptedDownload, serveZipFixtureCapturingRange, type CapturedRange } from './service.test-helpers.js';
import type { YCoreDatabase } from '../../db/index.js';
import type { TestServer } from './http-client.test-helpers.js';

const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');
const FULL_CONTENT_MARKER = 'contenido del juego';

async function waitUntilDone(service: DownloadService, id: string): Promise<void> {
  await vi.waitFor(
    () => {
      const found = service.list().find((d) => d.state.id === id);
      expect(found?.state.status).toBe('done');
    },
    { timeout: 5000, interval: 50 },
  );
}

/**
 * Regresión: `bytesDownloaded` en la DB se persiste agrupado por
 * `ProgressThrottle` (~4/s, ver `service.ts`), así que en el instante exacto
 * de un `kill -9` puede quedar por detrás de lo que ya hay escrito
 * físicamente en disco. Verificado en la app real (no solo aquí): pedir el
 * `Range` de la DB y reabrir el archivo en modo append duplicaba ese margen,
 * corrompiendo el archivo final (`download.integrity-mismatch`). El fix usa
 * el tamaño real del archivo en disco como fuente de verdad del offset de
 * reanudación, nunca la fila de la DB.
 */
describe('DownloadService.resumeInterrupted — el disco tiene más bytes que la DB', () => {
  let db: YCoreDatabase;
  let dir: string;
  let server: TestServer;
  let sha256: string;
  let buffer: Buffer;
  let capturedRange: CapturedRange;
  let installPath: string;
  let destinationPath: string;

  beforeEach(async () => {
    db = openInMemoryDb();
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'download-service-resume-disk-ahead-'));
    installPath = join(dir, 'install');
    destinationPath = `${installPath}.download`;
    ({ server, sha256, buffer, capturedRange } = await serveZipFixtureCapturingRange(dir, {
      'game.exe': FULL_CONTENT_MARKER,
    }));
  });

  afterEach(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
    db.$client.close();
  });

  it('pide el Range desde el tamaño real del archivo, no desde bytesDownloaded de la DB', async () => {
    // El archivo en disco tiene más bytes de los que la fila registra —
    // exactamente el estado que deja un kill -9 en el instante entre dos
    // muestras del throttle de progreso.
    const bytesActuallyOnDisk = 8;
    const bytesRecordedInDb = 3;
    writeFileSync(destinationPath, buffer.subarray(0, bytesActuallyOnDisk));

    const repository = new DownloadRepository(db);
    insertInterruptedDownload(repository, {
      id: 'resumed-id',
      sourceUrl: server.url,
      destinationPath,
      installPath,
      expectedSha256: sha256,
      bytesDownloaded: bytesRecordedInDb,
    });

    const freshService = new DownloadService(repository);
    freshService.resumeInterrupted();
    await waitUntilDone(freshService, 'resumed-id');

    // El Range pedido debe partir del tamaño real del disco (8), no del
    // valor desactualizado de la DB (3) — si partiera de 3, los bytes 3-7
    // (ya en disco) se descargarían de nuevo y se duplicarían al hacer
    // append, corrompiendo el archivo.
    expect(capturedRange.value).toBe(`bytes=${bytesActuallyOnDisk}-`);
    expect(readFileSync(join(installPath, 'game.exe'), 'utf8')).toBe(FULL_CONTENT_MARKER);
  });
});
