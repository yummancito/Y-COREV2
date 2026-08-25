import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isOk } from '@ycore/result';
import { DownloadRepository } from './repository.js';
import { DownloadService } from './service.js';
import { openInMemoryDb } from './test-helpers.js';
import type { YCoreDatabase } from '../../db/index.js';

const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');

describe('DownloadService.pause — queued (no-op)', () => {
  let db: YCoreDatabase;
  let service: DownloadService;
  let dir: string;

  beforeEach(() => {
    db = openInMemoryDb();
    service = new DownloadService(new DownloadRepository(db));
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'download-service-pause-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    db.$client.close();
  });

  it('pause sobre una descarga en queued no la mueve de estado (no-op)', async () => {
    const enqueued = service.enqueue({
      appId: 730,
      sourceUrl: 'http://127.0.0.1:1/no-existe',
      installPath: join(dir, 'install'),
      expectedSha256: 'a'.repeat(64),
    });
    expect(isOk(enqueued)).toBe(true);
    if (!isOk(enqueued)) return;

    const result = service.pause(enqueued.value.id);

    expect(isOk(result)).toBe(true);

    // enqueue() dispara run() en segundo plano contra una URL inalcanzable:
    // se espera a que falle antes de que afterEach cierre la DB, o queda un
    // save() pendiente contra una conexión ya cerrada.
    await vi.waitFor(
      () => {
        const found = service.list().find((d) => d.state.id === enqueued.value.id);
        expect(found?.state.status).toBe('failed');
      },
      { timeout: 5000, interval: 50 },
    );
  });
});
