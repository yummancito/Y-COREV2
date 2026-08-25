/**
 * `main/db` — API pública explícita del módulo de base de datos.
 *
 * Sirve para que los repositorios de features importen desde aquí, no desde
 * `schema.ts`/`client.ts` directamente — un solo punto de entrada estable
 * aunque el módulo interno se reorganice.
 */

export { games } from './schema.js';
export { openDatabase, defaultDbPath, type YCoreDatabase } from './client.js';
