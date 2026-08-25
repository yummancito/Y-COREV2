import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSteamInstallPath, realAcf } from './library-scanner.test-helpers.js';

vi.mock('../../platform/steam-registry.js');

// No se usa os.tmpdir(): en Windows puede resolver a una ruta con nombre
// corto 8.3 (p. ej. C:\Users\USERUN~1\...), y el watcher nativo de chokidar
// crashea el proceso al vigilar una ruta así (ver aprendizaje.md). Una
// carpeta bajo el propio repo tiene siempre ruta larga.
const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');

describe('startSteamLibraryWatcher', () => {
  let steamRoot: string;
  let steamAppsDir: string;

  beforeEach(() => {
    mkdirSync(TMP_TESTS_ROOT, { recursive: true });
    steamRoot = mkdtempSync(join(TMP_TESTS_ROOT, 'steam-watcher-'));
    steamAppsDir = join(steamRoot, 'steamapps');
    mkdirSync(steamAppsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(steamRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it('no arranca el watcher si Steam no está instalado', async () => {
    const { findSteamInstallPath } = await import('../../platform/steam-registry.js');
    vi.mocked(findSteamInstallPath).mockResolvedValue({
      ok: false,
      error: { code: 'not-found', retriable: false },
    });

    const { startSteamLibraryWatcher } = await import('./watcher.js');
    const onChange = vi.fn();
    const stop = await startSteamLibraryWatcher(onChange);

    await stop();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('detecta un ACF nuevo y llama al callback tras el debounce', async () => {
    await mockSteamInstallPath(steamRoot);

    const { startSteamLibraryWatcher } = await import('./watcher.js');
    const onChange = vi.fn();
    const stop = await startSteamLibraryWatcher(onChange);

    writeFileSync(join(steamAppsDir, 'appmanifest_730.acf'), realAcf('730', 'Counter-Strike 2', 'cs2'));

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce(), { timeout: 10000, interval: 200 });
    await stop();
  }, 15000);

  it('stop() cierra el watcher sin lanzar', async () => {
    await mockSteamInstallPath(steamRoot);

    const { startSteamLibraryWatcher } = await import('./watcher.js');
    const stop = await startSteamLibraryWatcher(vi.fn());

    await expect(stop()).resolves.toBeUndefined();
  });
});
