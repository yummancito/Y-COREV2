import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import type { YCoreDatabase } from '../../db/index.js';
import { DownloadRepository } from './repository.js';
import { fakeMetadata, openInMemoryDb } from './test-helpers.js';

describe('DownloadRepository.insert', () => {
  let db: YCoreDatabase;
  let repository: DownloadRepository;

  beforeEach(() => {
    db = openInMemoryDb();
    repository = new DownloadRepository(db);
  });

  afterEach(() => {
    db.$client.close();
  });

  it('inserta una descarga nueva siempre en estado queued', () => {
    const result = repository.insert('d1', fakeMetadata());

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.state).toEqual({ id: 'd1', status: 'queued' });
      expect(result.value.metadata.appId).toBe(730);
    }
  });

  it('rechaza una segunda descarga activa del mismo appId con download.duplicate', () => {
    repository.insert('d1', fakeMetadata({ appId: 730 }));

    const result = repository.insert('d2', fakeMetadata({ appId: 730 }));

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('download.duplicate');
  });

  it('permite dos descargas activas de appIds distintos', () => {
    repository.insert('d1', fakeMetadata({ appId: 730 }));

    const result = repository.insert('d2', fakeMetadata({ appId: 70 }));

    expect(isOk(result)).toBe(true);
  });

  it('permite una descarga nueva del mismo appId una vez la anterior terminó (done)', () => {
    repository.insert('d1', fakeMetadata({ appId: 730 }));
    repository.save({ id: 'd1', status: 'downloading', bytesDownloaded: 0, bytesTotal: null }, '2026-01-01T00:00:01.000Z');
    repository.save({ id: 'd1', status: 'verifying' }, '2026-01-01T00:00:02.000Z');
    repository.save({ id: 'd1', status: 'extracting' }, '2026-01-01T00:00:03.000Z');
    repository.save({ id: 'd1', status: 'installing' }, '2026-01-01T00:00:04.000Z');
    repository.save({ id: 'd1', status: 'done' }, '2026-01-01T00:00:05.000Z');

    const result = repository.insert('d2', fakeMetadata({ appId: 730 }));

    expect(isOk(result)).toBe(true);
  });
});
