import { describe, expect, it } from 'vitest';
import { libraryChannels } from './library.js';

describe('libraryChannels', () => {
  it('library.list acepta un payload vacío', () => {
    expect(libraryChannels['library.list'].input.safeParse({}).success).toBe(true);
  });

  it('library.list.output exige un array de games', () => {
    const output = {
      games: [
        {
          appId: 730,
          name: 'Counter-Strike 2',
          installation: null,
        },
      ],
    };
    expect(libraryChannels['library.list'].output.safeParse(output).success).toBe(true);
  });

  it('library.list.output con installation no nula valida sus campos', () => {
    const output = {
      games: [
        {
          appId: 70,
          name: 'Half-Life',
          installation: {
            path: 'C:\\Steam\\steamapps\\common\\Half-Life',
            executablePath: 'C:\\Steam\\steamapps\\common\\Half-Life\\hl.exe',
            sizeOnDiskBytes: 1000,
            lastPlayedAt: null,
          },
        },
      ],
    };
    expect(libraryChannels['library.list'].output.safeParse(output).success).toBe(true);
  });

  it('library.launch.input rechaza un appId negativo', () => {
    expect(libraryChannels['library.launch'].input.safeParse({ appId: -1 }).success).toBe(false);
  });

  it('library.launch.input acepta un appId positivo', () => {
    expect(libraryChannels['library.launch'].input.safeParse({ appId: 730 }).success).toBe(true);
  });

  it('library.launch.output exige un pid entero', () => {
    expect(libraryChannels['library.launch'].output.safeParse({ pid: 1234 }).success).toBe(true);
    expect(libraryChannels['library.launch'].output.safeParse({ pid: 'no' }).success).toBe(false);
  });
});
