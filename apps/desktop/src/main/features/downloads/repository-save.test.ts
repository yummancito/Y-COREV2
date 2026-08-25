import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isOk } from '@ycore/result';
import type { YCoreDatabase } from '../../db/index.js';
import { DownloadRepository } from './repository.js';
import { fakeMetadata, openInMemoryDb } from './test-helpers.js';

describe('DownloadRepository.save', () => {
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

  it('persiste bytesDownloaded y bytesTotal de un estado downloading', () => {
    repository.save({ id: 'd1', status: 'downloading', bytesDownloaded: 500, bytesTotal: 1000 }, 'now');

    const result = repository.findById('d1');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.state).toEqual({ id: 'd1', status: 'downloading', bytesDownloaded: 500, bytesTotal: 1000 });
    }
  });

  it('persiste el código de error de un estado failed', () => {
    // Solo se persiste error_code (una columna text), no el AppError entero:
    // al leerlo se reconstruye con appError(code), que recalcula `retriable`
    // por defecto según el código — no hay una columna `retriable` en la tabla.
    repository.save({ id: 'd1', status: 'failed', error: { code: 'net.unreachable', retriable: true } }, 'now');

    const result = repository.findById('d1');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.state).toEqual({
        id: 'd1',
        status: 'failed',
        error: { code: 'net.unreachable', retriable: true },
      });
    }
  });

  it('un estado sin campos extra (verifying) solo actualiza status', () => {
    repository.save({ id: 'd1', status: 'verifying' }, 'now');

    const result = repository.findById('d1');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.state).toEqual({ id: 'd1', status: 'verifying' });
  });
});
