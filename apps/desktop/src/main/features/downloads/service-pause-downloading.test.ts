import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isOk } from '@ycore/result';
import { DownloadRepository } from './repository.js';
import { DownloadService } from './service.js';
import { openInMemoryDb } from './test-helpers.js';
import { insertInterruptedDownload } from './service.test-helpers.js';
import type { YCoreDatabase } from '../../db/index.js';

const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');

describe('DownloadService.pause — downloading', () => {
  let db: YCoreDatabase;
  let repository: DownloadRepository;
  let service: DownloadService;
  let dir: string;

  beforeEach(() => {
    db = openInMemoryDb();
    repository = new DownloadRepository(db);
    service = new DownloadService(repository);
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'download-service-pause-dl-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    db.$client.close();
  });

  it('pause sobre una descarga downloading la mueve a paused', () => {
    const destinationPath = join(dir, 'install.download');
    const installPath = join(dir, 'install');
    insertInterruptedDownload(repository, {
      id: 'd1',
      sourceUrl: 'http://127.0.0.1:1/no-existe',
      destinationPath,
      installPath,
      expectedSha256: 'a'.repeat(64),
      bytesDownloaded: 10,
    });

    const result = service.pause('d1');

    expect(isOk(result)).toBe(true);
    const found = repository.findById('d1');
    expect(isOk(found) && found.value.state).toEqual({
      id: 'd1',
      status: 'paused',
      bytesDownloaded: 10,
      bytesTotal: null,
    });
  });
});
