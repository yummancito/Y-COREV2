import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloadRepository } from './repository.js';
import { DownloadService } from './service.js';
import { openInMemoryDb } from './test-helpers.js';
import {
  insertInterruptedDownload,
  serveZipFixtureCapturingRange,
  type CapturedRange,
} from './service.test-helpers.js';
import type { YCoreDatabase } from '../../db/index.js';
import type { TestServer } from './http-client.test-helpers.js';

const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');
const FULL_CONTENT_MARKER = 'contenido del juego';

describe('DownloadService.resumeInterrupted — criterio de HECHO de Fase 4', () => {
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
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'download-service-resume-'));
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

  it('retoma una descarga que quedó en downloading (kill -9) desde el offset ya persistido', async () => {
    // Simula el estado exacto que deja un `kill -9` a mitad de descarga: una
    // fila `downloading` con bytesDownloaded > 0 y el archivo parcial real en
    // disco con esos mismos bytes — nadie llamó a pause(), el proceso murió.
    const partialBytes = 5;
    writeFileSync(destinationPath, buffer.subarray(0, partialBytes));

    const repository = new DownloadRepository(db);
    insertInterruptedDownload(repository, {
      id: 'resumed-id',
      sourceUrl: server.url,
      destinationPath,
      installPath,
      expectedSha256: sha256,
      bytesDownloaded: partialBytes,
    });

    // Nueva instancia "tras reiniciar el proceso": no sabe nada de la
    // memoria anterior, solo lee la DB.
    const freshService = new DownloadService(repository);
    freshService.resumeInterrupted();

    await vi.waitFor(
      () => {
        const found = freshService.list().find((d) => d.state.id === 'resumed-id');
        expect(found?.state.status).toBe('done');
      },
      { timeout: 5000, interval: 50 },
    );

    expect(capturedRange.value).toBe(`bytes=${partialBytes}-`);
    expect(readFileSync(join(installPath, 'game.exe'), 'utf8')).toBe(FULL_CONTENT_MARKER);
  });
});
