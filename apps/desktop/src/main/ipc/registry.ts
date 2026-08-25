/**
 * `buildRegistry` — construye el mapa `nombre de canal → handler` que el router ejecuta.
 *
 * Sirve para separar "qué canales existen y qué hace cada uno" (aquí) de "cómo se
 * valida y se conecta a Electron" (router.ts). Una feature nueva añade su entrada
 * aquí — nunca escribe su propio `ipcMain.handle` (ADR-0002, regla B.1).
 *
 * Es una función (no un objeto estático) porque los handlers de features reales
 * necesitan dependencias que solo existen tras el arranque — la conexión de DB
 * abierta por `main/bootstrap/database.ts`. Construir el registry demasiado
 * pronto (a nivel de módulo) obligaría a los handlers a abrir su propia
 * conexión, rompiendo "una sola conexión, un solo lugar que sabe la ruta".
 */

import { ok, type Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import { contract, type ChannelInput, type ChannelName, type ChannelOutput } from '@ycore/ipc-contract';
import type { YCoreDatabase } from '../db/index.js';
import { createLibraryHandlers, LibraryRepository, LibraryService } from '../features/library/index.js';
import { createSteamHandlers, SteamService } from '../features/steam/index.js';
import { createDownloadHandlers, DownloadRepository, DownloadService } from '../features/downloads/index.js';

/**
 * Firma de un handler para el canal `C`: recibe input ya validado, nunca lanza.
 * No se exporta: hoy solo la usa {@link Registry} en este archivo. Si un
 * `handlers.ts` de feature necesita expresar esta firma explícitamente (hoy
 * `library/handlers.ts` tipa cada método por separado con `ChannelInput`/
 * `ChannelOutput`), se vuelve a exportar desde aquí en vez de duplicarla.
 */
type ChannelHandler<C extends ChannelName> = (
  input: ChannelInput<(typeof contract)[C]>,
) => Promise<Result<ChannelOutput<(typeof contract)[C]>, AppError>>;

/** Mapa completo `canal → handler`. Debe cubrir el 100% de `ChannelName` (ver check:contract). */
export type Registry = { [C in ChannelName]: ChannelHandler<C> };

function handleAppPing(): Promise<Result<{ pong: true; receivedAt: string }, AppError>> {
  return Promise.resolve(ok({ pong: true, receivedAt: new Date().toISOString() }));
}

/**
 * Construye el registro completo. Se llama una vez en el bootstrap, después
 * de abrir la base de datos.
 *
 * @param db - Conexión de Drizzle ya migrada, para los repositorios de features.
 */
export function buildRegistry(db: YCoreDatabase): Registry {
  const libraryRepository = new LibraryRepository(db);
  const library = createLibraryHandlers(new LibraryService(libraryRepository));
  const steam = createSteamHandlers(new SteamService(libraryRepository));
  const downloads = createDownloadHandlers(new DownloadService(new DownloadRepository(db)));

  return {
    'app.ping': handleAppPing,
    'library.list': library.listGames,
    'library.launch': library.launchGame,
    'steam.importLibrary': steam.importLibrary,
    'downloads.enqueue': downloads.enqueue,
    'downloads.list': downloads.list,
    'downloads.pause': downloads.pause,
    'downloads.cancel': downloads.cancel,
  };
}
