import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { games, type YCoreDatabase } from '../../db/index.js';
import { LibraryRepository } from './repository.js';
import { openInMemoryDb } from './test-helpers.js';
import type { Game } from '@ycore/core-domain';

describe('LibraryRepository.upsertMany', () => {
  let db: YCoreDatabase;
  let repository: LibraryRepository;

  beforeEach(() => {
    db = openInMemoryDb();
    repository = new LibraryRepository(db);
  });

  afterEach(() => {
    db.$client.close();
  });

  it('con una lista vacía no hace nada', () => {
    repository.upsertMany([]);
    expect(db.select().from(games).all()).toEqual([]);
  });

  it('inserta juegos nuevos', () => {
    const newGames: Game[] = [
      { appId: 730, name: 'Counter-Strike 2', installation: null },
      {
        appId: 70,
        name: 'Half-Life',
        installation: {
          path: 'C:\\Steam\\common\\Half-Life',
          executablePath: null,
          sizeOnDiskBytes: 500,
          lastPlayedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    ];

    repository.upsertMany(newGames);

    expect(repository.findAll()).toEqual(
      expect.arrayContaining([
        { appId: 730, name: 'Counter-Strike 2', installation: null },
        {
          appId: 70,
          name: 'Half-Life',
          installation: {
            path: 'C:\\Steam\\common\\Half-Life',
            executablePath: null,
            sizeOnDiskBytes: 500,
            lastPlayedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      ]),
    );
  });
});
