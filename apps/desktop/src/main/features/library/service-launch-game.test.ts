import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { games, type YCoreDatabase } from '../../db/index.js';
import { LibraryRepository } from './repository.js';
import { LibraryService } from './service.js';
import { openInMemoryDb } from './test-helpers.js';

describe('LibraryService.launchGame', () => {
  let db: YCoreDatabase;
  let service: LibraryService;

  beforeEach(() => {
    db = openInMemoryDb();
    service = new LibraryService(new LibraryRepository(db));
  });

  afterEach(() => {
    db.$client.close();
  });

  it('devuelve AppError not-found si el appId no existe en la biblioteca', () => {
    const result = service.launchGame(999999);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('devuelve AppError unknown si el juego está instalado sin executablePath resuelto', () => {
    db.insert(games)
      .values({ appId: 70, name: 'Half-Life', installationPath: 'C:\\Steam\\Half-Life' })
      .run();

    const result = service.launchGame(70);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('unknown');
  });

  it('caso feliz: lanza el proceso y devuelve su pid', () => {
    // hostname.exe: utilidad estándar de Windows que imprime y sale sola,
    // sin necesitar argumentos (a diferencia de cmd.exe, que sin /c queda
    // como shell interactiva colgada en background).
    db.insert(games)
      .values({
        appId: 1,
        name: 'hostname de prueba',
        installationPath: process.cwd(),
        executablePath: 'hostname.exe',
      })
      .run();

    const result = service.launchGame(1);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.pid).toBeGreaterThan(0);
  });
});
