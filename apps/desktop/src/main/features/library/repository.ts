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

/** Convierte un `Game` de dominio a las columnas planas que espera la tabla `games`. */
function gameToRow(game: Game): typeof games.$inferInsert {
  return {
    appId: game.appId,
    name: game.name,
    installationPath: game.installation?.path ?? null,
    executablePath: game.installation?.executablePath ?? null,
    sizeOnDiskBytes: game.installation?.sizeOnDiskBytes ?? null,
    lastPlayedAt: game.installation?.lastPlayedAt ?? null,
  };
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

  /**
   * Inserta o actualiza varios juegos de una vez — el caso de uso de
   * `scanSteamLibrary` (`main/features/steam`): un juego que ya existía en
   * la tabla (mismo `appId`) se actualiza con los datos frescos del disco;
   * uno nuevo se inserta. No borra juegos que ya no aparecen en el escaneo
   * (un juego desinstalado sigue siendo parte del catálogo conocido, solo
   * que con `installation: null` — eso lo decide quien llama, no este método).
   */
  upsertMany(gamesToUpsert: readonly Game[]): void {
    if (gamesToUpsert.length === 0) return;

    for (const game of gamesToUpsert) {
      this.db
        .insert(games)
        .values(gameToRow(game))
        .onConflictDoUpdate({ target: games.appId, set: gameToRow(game) })
        .run();
    }
  }
}
