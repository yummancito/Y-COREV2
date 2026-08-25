/**
 * `openDatabase` — abre (o crea) la base SQLite local y aplica migraciones.
 *
 * Sirve como el único punto donde se conecta a disco: features consumen el
 * `Database` que devuelve esto, nunca abren su propio `better-sqlite3`
 * directamente — así hay una sola conexión y un solo lugar que sabe la ruta
 * real del archivo.
 */

import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database, { type Database as SqliteConnection } from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createLogger } from '@ycore/logger';
import * as schema from './schema.js';

const log = createLogger('main:db');

/**
 * Tipo de retorno real de `drizzle()`: el `BetterSQLite3Database` genérico más
 * `$client`, la conexión `better-sqlite3` subyacente. Se necesita `$client`
 * para cerrar la conexión al salir de la app (`main/index.ts`) y en los tests
 * que reabren el mismo archivo — sin cerrar, Windows bloquea el archivo.
 */
export type YCoreDatabase = BetterSQLite3Database<typeof schema> & { $client: SqliteConnection };

/**
 * Copia el archivo de DB a `<archivo>.bak` antes de aplicar migraciones nuevas.
 * Sirve para que una migración con un bug no destruya datos del usuario sin
 * posibilidad de recuperación manual — "backup automático" del roadmap (Fase 1).
 * No falla el arranque si el backup no se puede escribir (disco lleno, etc.):
 * solo lo registra, porque bloquear el arranque de la app por un backup es
 * peor que arrancar sin él.
 */
function backupIfExists(dbPath: string): void {
  if (!existsSync(dbPath)) return;
  try {
    copyFileSync(dbPath, `${dbPath}.bak`);
  } catch (error) {
    log.warn('no se pudo hacer backup de la DB antes de migrar', { detail: String(error) });
  }
}

/**
 * Abre la base de datos en `dbPath`, la respalda si ya existía, y aplica
 * todas las migraciones pendientes de `migrationsFolder`.
 *
 * @param dbPath - Ruta absoluta del archivo `.sqlite` (normalmente dentro de
 *   `app.getPath('userData')`, resuelto por el llamador en `main/bootstrap`).
 * @param migrationsFolder - Ruta absoluta a la carpeta de migraciones generadas.
 * @returns La instancia de Drizzle lista para usar.
 */
export function openDatabase(dbPath: string, migrationsFolder: string): YCoreDatabase {
  mkdirSync(dirname(dbPath), { recursive: true });
  backupIfExists(dbPath);

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });

  log.info('base de datos abierta y migrada', { dbPath });
  return db;
}

/** Ruta por defecto del archivo de DB dentro del directorio `userData` de Electron. */
export function defaultDbPath(userDataDir: string): string {
  return join(userDataDir, 'y-core.sqlite');
}
