import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { createUninstalledGame } from './game.js';
import { resolveLaunchCommand } from './launch.js';
import type { Game, Installation } from './game.js';

const fakeInstallation: Installation = {
  path: 'C:\\Steam\\steamapps\\common\\Half-Life',
  executablePath: 'C:\\Steam\\steamapps\\common\\Half-Life\\hl.exe',
  sizeOnDiskBytes: 1_000_000,
  lastPlayedAt: null,
};

describe('resolveLaunchCommand', () => {
  it('devuelve AppError not-found si el juego no está instalado', () => {
    const game = createUninstalledGame(70, 'Half-Life');
    const result = resolveLaunchCommand(game);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('devuelve AppError unknown si está instalado pero sin executablePath resuelto', () => {
    const game: Game = {
      appId: 70,
      name: 'Half-Life',
      installation: { ...fakeInstallation, executablePath: null },
    };
    const result = resolveLaunchCommand(game);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('unknown');
  });

  it('caso feliz: devuelve el comando con executablePath, cwd y args por defecto vacíos', () => {
    const game: Game = { appId: 70, name: 'Half-Life', installation: fakeInstallation };
    const result = resolveLaunchCommand(game);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({
        executablePath: fakeInstallation.executablePath,
        args: [],
        cwd: fakeInstallation.path,
      });
    }
  });

  it('pasa extraArgs de LaunchOptions al comando resuelto', () => {
    const game: Game = { appId: 70, name: 'Half-Life', installation: fakeInstallation };
    const result = resolveLaunchCommand(game, { extraArgs: ['-console'] });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.args).toEqual(['-console']);
  });
});
