import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isOk } from '@ycore/result';
import type { YCoreDatabase } from '../../db/index.js';
import { DownloadRepository } from './repository.js';
import { fakeMetadata, openInMemoryDb } from './test-helpers.js';

describe('DownloadRepository.save — paused, extracting, installing', () => {
  let db: YCoreDatabase;
  let repository: DownloadRepository;

  beforeEach(() => {
    db = openInMemoryDb();
    repository = new DownloadRepository(db);
    repository.insert('d1', fakeMetadata());
  });

  afterEach(() => {
    db.$client.close();
  });

  it('persiste bytesDownloaded y bytesTotal de un estado paused', () => {
    repository.save({ id: 'd1', status: 'paused', bytesDownloaded: 200, bytesTotal: 900 }, 'now');

    const result = repository.findById('d1');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.state).toEqual({ id: 'd1', status: 'paused', bytesDownloaded: 200, bytesTotal: 900 });
    }
  });

  it('recorre extracting e installing sin campos extra', () => {
    repository.save({ id: 'd1', status: 'extracting' }, 'now');
    let result = repository.findById('d1');
    expect(isOk(result) && result.value.state).toEqual({ id: 'd1', status: 'extracting' });

    repository.save({ id: 'd1', status: 'installing' }, 'now');
    result = repository.findById('d1');
    expect(isOk(result) && result.value.state).toEqual({ id: 'd1', status: 'installing' });
  });
});
