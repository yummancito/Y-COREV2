/**
 * `LibraryService` — lógica de la feature Biblioteca.
 *
 * Sirve para orquestar `LibraryRepository` (disco), `@ycore/core-domain`
 * (decisión pura de qué lanzar) y `main/platform` (ejecución real) sin que
 * los handlers de IPC (`handlers.ts`) conozcan ninguno de los tres
 * directamente — los handlers solo llaman a este servicio.
 */

import { flatMap, type Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import { resolveLaunchCommand, type Game } from '@ycore/core-domain';
import { spawnDetached } from '../../platform/process-launcher.js';
import type { LibraryRepository } from './repository.js';

export class LibraryService {
  constructor(private readonly repository: LibraryRepository) {}

  /** Todos los juegos conocidos, instalados o no. */
  listGames(): Game[] {
    return this.repository.findAll();
  }

  /**
   * Lanza un juego por su AppID.
   * @returns El PID del proceso lanzado, o un `AppError`: `not-found` si el
   *   AppID no existe en la biblioteca (delegado en `findById`), o cualquiera
   *   de los que puede devolver {@link resolveLaunchCommand} o `spawnDetached`.
   */
  launchGame(appId: number): Result<{ pid: number }, AppError> {
    const game = this.repository.findById(appId);
    return flatMap(game, (g: Game) => flatMap(resolveLaunchCommand(g), spawnDetached));
  }
}
