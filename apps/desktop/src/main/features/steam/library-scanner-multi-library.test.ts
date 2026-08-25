import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isOk } from '@ycore/result';
import { mockSteamInstallPath, realAcf } from './library-scanner.test-helpers.js';

vi.mock('../../platform/steam-registry.js');

describe('scanSteamLibrary — bibliotecas adicionales (libraryfolders.vdf)', () => {
  let steamRoot: string;

  beforeEach(() => {
    steamRoot = mkdtempSync(join(tmpdir(), 'ycore-steam-test-'));
    mkdirSync(join(steamRoot, 'steamapps'), { recursive: true });
  });

  afterEach(() => {
    rmSync(steamRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it('escanea también las bibliotecas adicionales declaradas', async () => {
    const secondLibrary = mkdtempSync(join(tmpdir(), 'ycore-steam-lib2-'));
    mkdirSync(join(secondLibrary, 'steamapps'), { recursive: true });
    writeFileSync(join(secondLibrary, 'steamapps', 'appmanifest_440.acf'), realAcf('440', 'Team Fortress 2', 'tf2'));

    const escapedPath = secondLibrary.replace(/\\/g, '\\\\');
    writeFileSync(
      join(steamRoot, 'steamapps', 'libraryfolders.vdf'),
      `"libraryfolders"\n{\n\t"1" { "path" "${escapedPath}" }\n}`,
    );
    writeFileSync(join(steamRoot, 'steamapps', 'appmanifest_730.acf'), realAcf('730', 'Counter-Strike 2', 'cs2'));

    await mockSteamInstallPath(steamRoot);

    const { scanSteamLibrary } = await import('./library-scanner.js');
    const result = await scanSteamLibrary();

    rmSync(secondLibrary, { recursive: true, force: true });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const appIds = result.value.map((g) => g.appId).sort((a, b) => a - b);
      expect(appIds).toEqual([440, 730]);
    }
  });

  it('una biblioteca adicional cuya carpeta ya no existe en disco se ignora sin fallar', async () => {
    writeFileSync(
      join(steamRoot, 'steamapps', 'libraryfolders.vdf'),
      '"libraryfolders"\n{\n\t"1" { "path" "Z:\\\\disco-que-no-existe" }\n}',
    );
    writeFileSync(join(steamRoot, 'steamapps', 'appmanifest_730.acf'), realAcf('730', 'Counter-Strike 2', 'cs2'));

    await mockSteamInstallPath(steamRoot);

    const { scanSteamLibrary } = await import('./library-scanner.js');
    const result = await scanSteamLibrary();

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.appId).toBe(730);
    }
  });
});
