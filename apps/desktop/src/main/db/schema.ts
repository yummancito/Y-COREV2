/**
 * Esquema Drizzle de la base local de Y-CORE (SQLite vía better-sqlite3).
 *
 * Sirve como la única fuente de verdad del esquema: Drizzle genera las
 * migraciones desde este archivo (`pnpm --filter @ycore/desktop db:generate`),
 * nunca se escribe SQL de migración a mano. Cada tabla se mapea a/desde un
 * tipo de `@ycore/core-domain` en el repositorio de su feature — este archivo
 * no importa `core-domain` para no acoplar el esquema físico a la forma del
 * dominio (columnas nullable en vez de un `Installation | null` anidado).
 */

import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

/**
 * Un juego conocido, con sus columnas de instalación en `null` si no está
 * instalado en esta máquina. Se mapea a `Game`/`Installation` de
 * `@ycore/core-domain` en `main/features/library/repository.ts` (Fase 2).
 */
export const games = sqliteTable('games', {
  appId: integer('app_id').primaryKey(),
  name: text('name').notNull(),
  installationPath: text('installation_path'),
  executablePath: text('executable_path'),
  sizeOnDiskBytes: integer('size_on_disk_bytes'),
  lastPlayedAt: text('last_played_at'),
});
