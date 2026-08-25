import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isOk } from '@ycore/result';
import { DownloadRepository } from './repository.js';
import { DownloadService } from './service.js';
import { openInMemoryDb } from './test-helpers.js';
import { serveZipFixture } from './service.test-helpers.js';
import type { YCoreDatabase } from '../../db/index.js';
import type { TestServer } from './http-client.test-helpers.js';

const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');
// Contenido aleatorio a propósito: DEFLATE comprime texto repetitivo a casi
// nada (2000 "x" pesan ~17 bytes comprimidos), lo que dejaría todo el ZIP
// dentro del burst inicial del TokenBucket sin frenar nada de verdad.
const RANDOM_CONTENT = randomBytes(1500).toString('base64');

describe('DownloadService — límite de ancho de banda', () => {
  let db: YCoreDatabase;
  let dir: string;
  let server: TestServer;

  beforeEach(async () => {
    db = openInMemoryDb();
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'download-service-bw-'));
    ({ server } = await serveZipFixture(dir, { 'game.exe': RANDOM_CONTENT }));
  });

  afterEach(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
    db.$client.close();
  });

  it('con un límite bajo, la descarga tarda más que sin límite (el token bucket frena de verdad)', async () => {
    const { sha256 } = await serveZipFixture(dir, { 'game.exe': RANDOM_CONTENT });
    const installPath = join(dir, 'install');
    const service = new DownloadService(new DownloadRepository(db), 500);

    const enqueued = service.enqueue({ appId: 730, sourceUrl: server.url, installPath, expectedSha256: sha256 });
    expect(isOk(enqueued)).toBe(true);
    if (!isOk(enqueued)) return;

    const startedAt = Date.now();
    await vi.waitFor(
      () => {
        const found = service.list().find((d) => d.state.id === enqueued.value.id);
        expect(found?.state.status).toBe('done');
      },
      // Timeout generoso: bajo carga (toda la suite corriendo en paralelo)
      // el proceso puede tardar bastante más que en aislado; lo que importa
      // es la aserción de tiempo mínimo de abajo, no cuánto tarda el waitFor.
      { timeout: 30000, interval: 100 },
    );

    // El ZIP completo (>1500 bytes) a 500 B/s tarda al menos ~2 segundos;
    // sin límite este mismo test termina en milisegundos (ver el resto de
    // tests de DownloadService). No se afirma un tiempo exacto — solo que el
    // límite frena de verdad, no que es un no-op.
    expect(Date.now() - startedAt).toBeGreaterThan(1000);
    expect(readFileSync(join(installPath, 'game.exe'), 'utf8')).toBe(RANDOM_CONTENT);
  }, 35000);
});
