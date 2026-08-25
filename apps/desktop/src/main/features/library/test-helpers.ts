/**
 * Helper compartido por los tests de `main/features/library` — abre una DB
 * SQLite en memoria real (no mockeada) con el esquema migrado, para probar
 * el repositorio y el servicio contra Drizzle de verdad.
 */

import { openDatabase, type YCoreDatabase } from '../../db/index.js';
import { MIGRATIONS_FOLDER } from '../../db/test-helpers.js';

/** Abre una DB SQLite en memoria con las migraciones aplicadas. Ciérrala con `$client.close()`. */
export function openInMemoryDb(): YCoreDatabase {
  return openDatabase(':memory:', MIGRATIONS_FOLDER);
}
