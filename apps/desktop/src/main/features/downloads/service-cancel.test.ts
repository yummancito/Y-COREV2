import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { DownloadRepository } from './repository.js';
import { DownloadService } from './service.js';
import { openInMemoryDb } from './test-helpers.js';
import { insertInterruptedDownload } from './service.test-helpers.js';
import type { YCoreDatabase } from '../../db/index.js';

const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');

describe('DownloadService.cancel', () => {
  let db: YCoreDatabase;
  let repository: DownloadRepository;
  let service: DownloadService;
  let dir: string;

  beforeEach(() => {
    db = openInMemoryDb();
    repository = new DownloadRepository(db);
    service = new DownloadService(repository);
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'download-service-cancel-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    db.$client.close();
  });

  it('cancel devuelve not-found si la descarga no existe', async () => {
    const result = await service.cancel('inexistente');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('cancel borra la fila y el archivo parcial', async () => {
    const destinationPath = join(dir, 'install.download');
    writeFileSync(destinationPath, 'parcial');
    insertInterruptedDownload(repository, {
      id: 'd1',
      sourceUrl: 'http://127.0.0.1:1/no-existe',
      destinationPath,
      installPath: join(dir, 'install'),
      expectedSha256: 'a'.repeat(64),
      bytesDownloaded: 7,
    });

    const result = await service.cancel('d1');

    expect(isOk(result)).toBe(true);
    expect(isErr(repository.findById('d1'))).toBe(true);
    expect(existsSync(destinationPath)).toBe(false);
  });
});
