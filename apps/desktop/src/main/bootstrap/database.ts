/**
 * `openAppDatabase` — abre la base de datos de Y-CORE en su ubicación real.
 *
 * Sirve para resolver la ruta real del archivo (`app.getPath('userData')`,
 * que depende de Electron) y pasársela a `main/db`, que en sí mismo no sabe
 * nada de Electron — solo recibe rutas ya resueltas. Separa "dónde vive la DB
 * en esta máquina" (aquí) de "cómo se abre y migra" (main/db/client.ts).
 */

import { join } from 'node:path';
import { app } from 'electron';
import { defaultDbPath, openDatabase, type YCoreDatabase } from '../db/index.js';

/**
 * @returns La instancia de Drizzle ya conectada y migrada, lista para que
 *   los repositorios de features la usen.
 */
export function openAppDatabase(): YCoreDatabase {
  const dbPath = defaultDbPath(app.getPath('userData'));
  const migrationsFolder = join(__dirname, '../db/migrations');
  return openDatabase(dbPath, migrationsFolder);
}
