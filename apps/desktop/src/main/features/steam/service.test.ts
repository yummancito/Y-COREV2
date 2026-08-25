import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { LibraryRepository } from '../library/repository.js';
import { openInMemoryDb } from '../library/test-helpers.js';
import type { YCoreDatabase } from '../../db/index.js';

vi.mock('./library-scanner.js');

describe('SteamService.importLibrary', () => {
  let db: YCoreDatabase;
  let repository: LibraryRepository;

  beforeEach(() => {
    db = openInMemoryDb();
    repository = new LibraryRepository(db);
  });

  afterEach(() => {
    db.$client.close();
    vi.resetModules();
  });

  it('caso feliz: guarda los juegos escaneados y devuelve cuántos se encontraron', async () => {
    const { scanSteamLibrary } = await import('./library-scanner.js');
    vi.mocked(scanSteamLibrary).mockResolvedValue({
      ok: true,
      value: [
        { appId: 730, name: 'Counter-Strike 2', installation: null },
        { appId: 70, name: 'Half-Life', installation: null },
      ],
    });

    const { SteamService } = await import('./service.js');
    const service = new SteamService(repository);
    const result = await service.importLibrary();

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual({ gamesFound: 2 });
    expect(repository.findAll()).toHaveLength(2);
  });

  it('si Steam no está instalado, propaga el AppError sin tocar la DB', async () => {
    const { scanSteamLibrary } = await import('./library-scanner.js');
    vi.mocked(scanSteamLibrary).mockResolvedValue({
      ok: false,
      error: { code: 'not-found', retriable: false },
    });

    const { SteamService } = await import('./service.js');
    const service = new SteamService(repository);
    const result = await service.importLibrary();

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
    expect(repository.findAll()).toEqual([]);
  });
});
