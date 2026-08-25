/**
 * `SteamService` — lógica de la feature Steam.
 *
 * Sirve para orquestar `scanSteamLibrary` (disco) y `LibraryRepository`
 * (persistencia) sin que los handlers de IPC conozcan ninguno de los dos
 * directamente. Mismo patrón que `LibraryService` (`main/features/library`).
 */

import { map, type Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import type { LibraryRepository } from '../library/repository.js';
import { scanSteamLibrary } from './library-scanner.js';

export class SteamService {
  constructor(private readonly libraryRepository: LibraryRepository) {}

  /**
   * Escanea la biblioteca real de Steam de esta máquina y guarda lo
   * encontrado en la tabla `games` (inserta juegos nuevos, actualiza los
   * que ya existían).
   *
   * @returns Cuántos juegos se encontraron, o el `AppError` de
   *   {@link scanSteamLibrary} (típicamente `not-found` si Steam no está
   *   instalado).
   */
  async importLibrary(): Promise<Result<{ gamesFound: number }, AppError>> {
    const scanned = await scanSteamLibrary();
    return map(scanned, (games) => {
      this.libraryRepository.upsertMany(games);
      return { gamesFound: games.length };
    });
  }
}
