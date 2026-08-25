/**
 * `startSteamLibraryWatcher` — sincroniza la DB automáticamente cuando cambian
 * los `appmanifest_*.acf` de Steam en disco.
 *
 * Sirve para que instalar, actualizar o desinstalar un juego **fuera** de
 * Y-CORE (desde el propio cliente de Steam) se refleje en la biblioteca sin
 * que el usuario tenga que pulsar "importar" de nuevo. Steam reescribe un ACF
 * varias veces seguidas durante una instalación (progreso, tamaño final,
 * `lastUpdated`), así que los eventos se agrupan con debounce antes de
 * disparar una re-importación completa — un escaneo por ráfaga de escritura,
 * no uno por evento.
 *
 * @param onLibraryChanged - Callback invocado (una vez por ráfaga) cuando se
 *   detecta un cambio; normalmente `() => steamService.importLibrary()`.
 * @returns Una función `stop()` que cierra el watcher. Debe llamarse en
 *   `will-quit` — un `FSWatcher` de chokidar sin cerrar impide que el proceso
 *   termine limpio. La promesa solo se resuelve una vez que chokidar terminó
 *   su crawling inicial (evento `ready`): devolverla antes dejaría una
 *   ventana donde un cambio en disco inmediatamente posterior al arranque se
 *   pierde sin disparar el callback.
 */

import { watch, type FSWatcher } from 'chokidar';
import { createLogger } from '@ycore/logger';
import { findSteamInstallPath } from '../../platform/steam-registry.js';
import { resolveSteamAppsDirs } from './library-scanner.js';

const log = createLogger('main:features:steam:watcher');

const DEBOUNCE_MS = 2000;
const APP_MANIFEST_PATTERN = /^appmanifest_\d+\.acf$/;

export async function startSteamLibraryWatcher(
  onLibraryChanged: () => void | Promise<void>,
): Promise<() => Promise<void>> {
  const steamPathResult = await findSteamInstallPath();
  if (steamPathResult.ok === false) {
    log.info('Steam no está instalado, watcher no arranca', { code: steamPathResult.error.code });
    return async () => {};
  }

  const steamAppsDirs = await resolveSteamAppsDirs(steamPathResult.value);

  let debounceTimer: NodeJS.Timeout | undefined;
  // Se vigila la carpeta completa (no un glob `appmanifest_*.acf`): en Windows,
  // el watcher nativo de chokidar no dispara eventos con un patrón glob y,
  // sobre una ruta con nombre corto (8.3), directamente crashea el proceso.
  // Vigilar el directorio y filtrar por nombre en el callback es la forma
  // robusta de hacerlo aquí (ver aprendizaje.md).
  const watcher: FSWatcher = watch(steamAppsDirs, {
    ignoreInitial: true,
    awaitWriteFinish: true,
    depth: 0,
  });
  await new Promise<void>((resolve) => watcher.on('ready', resolve));

  const scheduleSync = (event: string, path: string): void => {
    if (!APP_MANIFEST_PATTERN.test(path.split(/[/\\]/).pop() ?? '')) return;
    log.info('cambio detectado en biblioteca de Steam', { event, path });
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void onLibraryChanged(), DEBOUNCE_MS);
  };

  watcher.on('add', (path) => scheduleSync('add', path));
  watcher.on('change', (path) => scheduleSync('change', path));
  watcher.on('unlink', (path) => scheduleSync('unlink', path));
  watcher.on('error', (error) => log.warn('error del watcher de Steam', { detail: String(error) }));

  log.info('watcher de biblioteca de Steam arrancado', { carpetas: steamAppsDirs.length });

  return async () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    await watcher.close();
  };
}
