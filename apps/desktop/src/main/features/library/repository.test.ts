import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { games, type YCoreDatabase } from '../../db/index.js';
import { LibraryRepository } from './repository.js';
import { openInMemoryDb } from './test-helpers.js';

describe('LibraryRepository.findAll', () => {
  let db: YCoreDatabase;
  let repository: LibraryRepository;

  beforeEach(() => {
    db = openInMemoryDb();
    repository = new LibraryRepository(db);
  });

  afterEach(() => {
    db.$client.close();
  });

  it('devuelve un array vacío si no hay juegos', () => {
    expect(repository.findAll()).toEqual([]);
  });

  it('mapea installationPath null a installation: null', () => {
    db.insert(games).values({ appId: 730, name: 'Counter-Strike 2' }).run();

    expect(repository.findAll()).toEqual([
      { appId: 730, name: 'Counter-Strike 2', installation: null },
    ]);
  });

  it('mapea columnas de instalación no nulas a un objeto Installation completo', () => {
    db.insert(games)
      .values({
        appId: 70,
        name: 'Half-Life',
        installationPath: 'C:\\Steam\\common\\Half-Life',
        executablePath: 'C:\\Steam\\common\\Half-Life\\hl.exe',
        sizeOnDiskBytes: 500,
        lastPlayedAt: '2026-01-01T00:00:00.000Z',
      })
      .run();

    expect(repository.findAll()).toEqual([
      {
        appId: 70,
        name: 'Half-Life',
        installation: {
          path: 'C:\\Steam\\common\\Half-Life',
          executablePath: 'C:\\Steam\\common\\Half-Life\\hl.exe',
          sizeOnDiskBytes: 500,
          lastPlayedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    ]);
  });
});
