import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { DownloadRepository } from './repository.js';
import { DownloadService } from './service.js';
import { openInMemoryDb } from './test-helpers.js';
import { serveZipFixture } from './service.test-helpers.js';
import type { YCoreDatabase } from '../../db/index.js';
import type { TestServer } from './http-client.test-helpers.js';

const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');

describe('DownloadService — duplicados', () => {
  let db: YCoreDatabase;
  let service: DownloadService;
  let dir: string;
  let server: TestServer;

  beforeEach(async () => {
    db = openInMemoryDb();
    service = new DownloadService(new DownloadRepository(db));
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'download-service-dup-'));
    ({ server } = await serveZipFixture(dir, { 'game.exe': 'contenido del juego' }));
  });

  afterEach(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
    db.$client.close();
  });

  it('rechaza una segunda descarga activa del mismo appId con download.duplicate', async () => {
    const installPath = join(dir, 'install');
    const first = service.enqueue({ appId: 730, sourceUrl: server.url, installPath, expectedSha256: 'a'.repeat(64) });

    const second = service.enqueue({
      appId: 730,
      sourceUrl: server.url,
      installPath,
      expectedSha256: 'b'.repeat(64),
    });

    expect(isErr(second)).toBe(true);
    if (isErr(second)) expect(second.error.code).toBe('download.duplicate');

    // La primera descarga (con un hash inventado) sigue corriendo en segundo
    // plano tras enqueue(): se espera a que llegue a un estado terminal antes
    // de que afterEach cierre el servidor y la DB, o queda un fetch/save
    // pendiente contra recursos ya cerrados (unhandled rejection).
    if (isOk(first)) {
      await vi.waitFor(
        () => {
          const found = service.list().find((d) => d.state.id === first.value.id);
          expect(found?.state.status).toBe('failed');
        },
        { timeout: 5000, interval: 50 },
      );
    }
  });
});
