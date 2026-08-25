import { describe, expect, it } from 'vitest';
import { createUninstalledGame, isInstalled, type Game, type Installation } from './game.js';

const fakeInstallation: Installation = {
  path: 'C:\\Steam\\steamapps\\common\\Half-Life',
  executablePath: 'C:\\Steam\\steamapps\\common\\Half-Life\\hl.exe',
  sizeOnDiskBytes: 1_000_000,
  lastPlayedAt: null,
};

describe('createUninstalledGame', () => {
  it('produce un Game con installation en null', () => {
    const game = createUninstalledGame(70, 'Half-Life');
    expect(game).toEqual({ appId: 70, name: 'Half-Life', installation: null });
  });
});

describe('isInstalled', () => {
  it('devuelve false para un juego sin instalación', () => {
    const game = createUninstalledGame(70, 'Half-Life');
    expect(isInstalled(game)).toBe(false);
  });

  it('devuelve true para un juego con installation', () => {
    const game: Game = { appId: 70, name: 'Half-Life', installation: fakeInstallation };
    expect(isInstalled(game)).toBe(true);
  });

  it('estrecha el tipo: tras isInstalled, installation ya no es null en TS', () => {
    const game: Game = { appId: 70, name: 'Half-Life', installation: fakeInstallation };
    if (isInstalled(game)) {
      // Esta línea no compilaría si el type guard no estrechara el tipo.
      expect(game.installation.path).toBe(fakeInstallation.path);
    } else {
      expect.unreachable('el juego de este test siempre está instalado');
    }
  });
});
