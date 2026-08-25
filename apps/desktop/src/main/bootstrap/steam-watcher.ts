/**
 * `startSteamWatcher` — arranca el watcher de biblioteca de Steam en el bootstrap.
 *
 * Sirve para conectar `main/features/steam` (que no sabe nada de `app.on`) con
 * el ciclo de vida real de Electron: arranca tras abrir la DB y se detiene en
 * `will-quit`, igual que la propia conexión de base de datos
 * (`main/bootstrap/database.ts`). Separado de `main/index.ts` para que el
 * punto de entrada no crezca por cada feature que necesite un watcher.
 *
 * @param db - Conexión de Drizzle ya migrada, para que el watcher pueda
 *   guardar lo que encuentre vía `LibraryRepository`.
 */

import { app } from 'electron';
import { createLogger } from '@ycore/logger';
import type { YCoreDatabase } from '../db/index.js';
import { LibraryRepository } from '../features/library/index.js';
import { SteamService, startSteamLibraryWatcher } from '../features/steam/index.js';

const log = createLogger('main:bootstrap:steam-watcher');

export async function startSteamWatcher(db: YCoreDatabase): Promise<void> {
  const steamService = new SteamService(new LibraryRepository(db));

  const stop = await startSteamLibraryWatcher(async () => {
    const result = await steamService.importLibrary();
    if (result.ok === false) {
      log.warn('re-importación automática falló', { code: result.error.code });
    }
  });

  app.on('will-quit', () => void stop());
}
