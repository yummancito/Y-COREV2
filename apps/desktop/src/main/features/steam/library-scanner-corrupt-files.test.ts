import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isOk } from '@ycore/result';
import { mockSteamInstallPath, realAcf } from './library-scanner.test-helpers.js';

vi.mock('../../platform/steam-registry.js');

describe('scanSteamLibrary — archivos corruptos o ilegibles', () => {
  let steamRoot: string;

  beforeEach(() => {
    steamRoot = mkdtempSync(join(tmpdir(), 'ycore-steam-test-'));
    mkdirSync(join(steamRoot, 'steamapps'), { recursive: true });
  });

  afterEach(() => {
    rmSync(steamRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it('un appmanifest corrupto se ignora sin tumbar el escaneo completo', async () => {
    writeFileSync(join(steamRoot, 'steamapps', 'appmanifest_1.acf'), '"AppState"\n{\n\t"appid"');
    writeFileSync(join(steamRoot, 'steamapps', 'appmanifest_730.acf'), realAcf('730', 'Counter-Strike 2', 'cs2'));

    await mockSteamInstallPath(steamRoot);

    const { scanSteamLibrary } = await import('./library-scanner.js');
    const result = await scanSteamLibrary();

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toHaveLength(1);
  });

  it('un appmanifest que en realidad es un directorio (readFile falla) se ignora', async () => {
    mkdirSync(join(steamRoot, 'steamapps', 'appmanifest_999.acf'));
    writeFileSync(join(steamRoot, 'steamapps', 'appmanifest_730.acf'), realAcf('730', 'Counter-Strike 2', 'cs2'));

    await mockSteamInstallPath(steamRoot);

    const { scanSteamLibrary } = await import('./library-scanner.js');
    const result = await scanSteamLibrary();

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toHaveLength(1);
  });
});
