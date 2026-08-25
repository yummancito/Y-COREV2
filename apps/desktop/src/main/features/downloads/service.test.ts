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

describe('DownloadService — ciclo completo caso feliz', () => {
  let db: YCoreDatabase;
  let service: DownloadService;
  let dir: string;
  let server: TestServer;

  beforeEach(async () => {
    db = openInMemoryDb();
    service = new DownloadService(new DownloadRepository(db));
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'download-service-'));
    ({ server } = await serveZipFixture(dir, { 'game.exe': 'contenido del juego' }));
  });

  afterEach(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
    db.$client.close();
  });

  it('descarga, verifica, extrae e instala, terminando en done', async () => {
    const { sha256 } = await serveZipFixture(dir, { 'game.exe': 'contenido del juego' });
    const installPath = join(dir, 'install');

    const enqueued = service.enqueue({
      appId: 730,
      sourceUrl: server.url,
      installPath,
      expectedSha256: sha256,
    });
    expect(isOk(enqueued)).toBe(true);
    if (!isOk(enqueued)) return;

    await vi.waitFor(
      () => {
        const found = service.list().find((d) => d.state.id === enqueued.value.id);
        expect(found?.state.status).toBe('done');
      },
      { timeout: 5000, interval: 50 },
    );

    expect(readFileSync(join(installPath, 'game.exe'), 'utf8')).toBe('contenido del juego');
  });
});
