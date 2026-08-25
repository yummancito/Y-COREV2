import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isOk } from '@ycore/result';
import { mockSteamInstallPath, realAcf } from './library-scanner.test-helpers.js';

vi.mock('../../platform/steam-registry.js');

describe('scanSteamLibrary — caso feliz', () => {
  let steamRoot: string;

  beforeEach(() => {
    steamRoot = mkdtempSync(join(tmpdir(), 'ycore-steam-test-'));
    mkdirSync(join(steamRoot, 'steamapps'), { recursive: true });
  });

  afterEach(() => {
    rmSync(steamRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it('parsea todos los appmanifest_*.acf de la biblioteca principal', async () => {
    writeFileSync(
      join(steamRoot, 'steamapps', 'appmanifest_730.acf'),
      realAcf('730', 'Counter-Strike 2', 'Counter-Strike Global Offensive', 41943040000),
    );
    writeFileSync(join(steamRoot, 'steamapps', 'appmanifest_70.acf'), realAcf('70', 'Half-Life', 'Half-Life'));
    // Un archivo que no matchea el patrón appmanifest_*.acf se ignora.
    writeFileSync(join(steamRoot, 'steamapps', 'libraryfolders.vdf'), '"libraryfolders"\n{\n}');

    await mockSteamInstallPath(steamRoot);

    const { scanSteamLibrary } = await import('./library-scanner.js');
    const result = await scanSteamLibrary();

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(2);
      const cs2 = result.value.find((g) => g.appId === 730);
      expect(cs2?.name).toBe('Counter-Strike 2');
      expect(cs2?.installation?.sizeOnDiskBytes).toBe(41943040000);
      expect(cs2?.installation?.lastPlayedAt).not.toBeNull();
    }
  });
});
