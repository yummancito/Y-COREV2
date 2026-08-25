import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr } from '@ycore/result';
import { DownloadRepository } from './repository.js';
import { DownloadService } from './service.js';
import { openInMemoryDb } from './test-helpers.js';
import type { YCoreDatabase } from '../../db/index.js';

const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');

describe('DownloadService.pause/cancel — descarga inexistente', () => {
  let db: YCoreDatabase;
  let service: DownloadService;
  let dir: string;

  beforeEach(() => {
    db = openInMemoryDb();
    service = new DownloadService(new DownloadRepository(db));
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'download-service-notfound-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    db.$client.close();
  });

  it('pause devuelve not-found si la descarga no existe', () => {
    const result = service.pause('inexistente');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('cancel devuelve not-found si la descarga no existe', async () => {
    const result = await service.cancel('inexistente');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });
});
