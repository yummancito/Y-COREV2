/**
 * `LibraryRepository` — acceso a disco de la feature Biblioteca.
 *
 * Sirve como el único lugar que traduce entre la tabla `games` (Drizzle,
 * columnas planas y nullable) y `Game`/`Installation` de `@ycore/core-domain`
 * (tipos anidados: `installation: Installation | null`). El servicio de la
 * feature (`service.ts`) nunca ve columnas de Drizzle, solo tipos de dominio.
 */

import { eq } from 'drizzle-orm';
import { err, ok, type Result } from '@ycore/result';
import { appError, type AppError } from '@ycore/result/app-error';
import type { Game, Installation } from '@ycore/core-domain';
import { games, type YCoreDatabase } from '../../db/index.js';

/** Fila cruda de la tabla `games`, tal como la devuelve Drizzle. */
type GameRow = typeof games.$inferSelect;

/** Convierte una fila de `games` al `Game` de dominio, armando `installation` si aplica. */
function rowToGame(row: GameRow): Game {
  const installation: Installation | null =
    row.installationPath === null
      ? null
      : {
          path: row.installationPath,
          executablePath: row.executablePath,
          sizeOnDiskBytes: row.sizeOnDiskBytes ?? 0,
          lastPlayedAt: row.lastPlayedAt,
        };

  return { appId: row.appId, name: row.name, installation };
}

export class LibraryRepository {
  constructor(private readonly db: YCoreDatabase) {}

  /** Todos los juegos conocidos, instalados o no. */
  findAll(): Game[] {
    return this.db.select().from(games).all().map(rowToGame);
  }

  /**
   * Busca un juego por su AppID.
   * @returns `Err('not-found')` si no existe ningún juego con ese AppID.
   */
  findById(appId: number): Result<Game, AppError> {
    const row = this.db.select().from(games).where(eq(games.appId, appId)).get();
    if (row === undefined) return err(appError('not-found', { context: { appId } }));
    return ok(rowToGame(row));
  }
}
