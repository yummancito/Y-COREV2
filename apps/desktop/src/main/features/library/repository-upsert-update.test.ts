import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { YCoreDatabase } from '../../db/index.js';
import { LibraryRepository } from './repository.js';
import { openInMemoryDb } from './test-helpers.js';

describe('LibraryRepository.upsertMany — actualización de juegos existentes', () => {
  let db: YCoreDatabase;
  let repository: LibraryRepository;

  beforeEach(() => {
    db = openInMemoryDb();
    repository = new LibraryRepository(db);
  });

  afterEach(() => {
    db.$client.close();
  });

  it('actualiza un juego que ya existía (mismo appId) en vez de duplicarlo', () => {
    repository.upsertMany([{ appId: 730, name: 'Nombre viejo', installation: null }]);

    repository.upsertMany([
      {
        appId: 730,
        name: 'Counter-Strike 2',
        installation: {
          path: 'C:\\Steam\\common\\cs2',
          executablePath: null,
          sizeOnDiskBytes: 1000,
          lastPlayedAt: null,
        },
      },
    ]);

    const all = repository.findAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe('Counter-Strike 2');
    expect(all[0]?.installation?.sizeOnDiskBytes).toBe(1000);
  });
});
