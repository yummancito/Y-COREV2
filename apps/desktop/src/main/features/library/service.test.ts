import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { games, type YCoreDatabase } from '../../db/index.js';
import { LibraryRepository } from './repository.js';
import { LibraryService } from './service.js';
import { openInMemoryDb } from './test-helpers.js';

describe('LibraryService.listGames', () => {
  let db: YCoreDatabase;
  let service: LibraryService;

  beforeEach(() => {
    db = openInMemoryDb();
    service = new LibraryService(new LibraryRepository(db));
  });

  afterEach(() => {
    db.$client.close();
  });

  it('delega en el repositorio y devuelve los Game tal cual', () => {
    db.insert(games).values({ appId: 730, name: 'Counter-Strike 2' }).run();

    expect(service.listGames()).toEqual([
      { appId: 730, name: 'Counter-Strike 2', installation: null },
    ]);
  });
});
