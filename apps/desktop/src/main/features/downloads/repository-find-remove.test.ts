import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr } from '@ycore/result';
import type { YCoreDatabase } from '../../db/index.js';
import { DownloadRepository } from './repository.js';
import { fakeMetadata, openInMemoryDb } from './test-helpers.js';

describe('DownloadRepository — find y remove', () => {
  let db: YCoreDatabase;
  let repository: DownloadRepository;

  beforeEach(() => {
    db = openInMemoryDb();
    repository = new DownloadRepository(db);
  });

  afterEach(() => {
    db.$client.close();
  });

  it('findById devuelve AppError not-found si no existe', () => {
    const result = repository.findById('inexistente');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('findAll devuelve todas las descargas conocidas', () => {
    repository.insert('d1', fakeMetadata({ appId: 730 }));
    repository.insert('d2', fakeMetadata({ appId: 70 }));

    expect(repository.findAll()).toHaveLength(2);
  });

  it('findActiveByAppId devuelve null si no hay ninguna descarga activa de ese appId', () => {
    expect(repository.findActiveByAppId(730)).toBeNull();
  });

  it('findActiveByAppId encuentra la descarga activa del appId dado', () => {
    repository.insert('d1', fakeMetadata({ appId: 730 }));

    const record = repository.findActiveByAppId(730);

    expect(record?.metadata.appId).toBe(730);
    expect(record?.state.status).toBe('queued');
  });

  it('findActiveByAppId ignora descargas ya terminadas (done)', () => {
    repository.insert('d1', fakeMetadata({ appId: 730 }));
    repository.save({ id: 'd1', status: 'downloading', bytesDownloaded: 0, bytesTotal: null }, 'now');
    repository.save({ id: 'd1', status: 'verifying' }, 'now');
    repository.save({ id: 'd1', status: 'extracting' }, 'now');
    repository.save({ id: 'd1', status: 'installing' }, 'now');
    repository.save({ id: 'd1', status: 'done' }, 'now');

    expect(repository.findActiveByAppId(730)).toBeNull();
  });

  it('remove borra la fila', () => {
    repository.insert('d1', fakeMetadata());

    repository.remove('d1');

    const result = repository.findById('d1');
    expect(isErr(result)).toBe(true);
  });
});
