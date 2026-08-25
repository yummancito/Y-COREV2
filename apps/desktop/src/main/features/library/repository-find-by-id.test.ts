import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { games, type YCoreDatabase } from '../../db/index.js';
import { LibraryRepository } from './repository.js';
import { openInMemoryDb } from './test-helpers.js';

describe('LibraryRepository.findById', () => {
  let db: YCoreDatabase;
  let repository: LibraryRepository;

  beforeEach(() => {
    db = openInMemoryDb();
    repository = new LibraryRepository(db);
  });

  afterEach(() => {
    db.$client.close();
  });

  it('devuelve AppError not-found si el appId no existe', () => {
    const result = repository.findById(999999);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('caso feliz: devuelve el Game si el appId existe', () => {
    db.insert(games).values({ appId: 730, name: 'Counter-Strike 2' }).run();

    const result = repository.findById(730);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ appId: 730, name: 'Counter-Strike 2', installation: null });
    }
  });
});
