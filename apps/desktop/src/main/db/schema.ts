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

import { sqliteTable, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

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

/**
 * Cola de descargas del motor (ADR-0004, Fase 4). Es la única fuente de
 * verdad de qué se está descargando: nunca vive en memoria ni en zustand, así
 * que sobrevive a un `kill -9` del proceso. Se mapea a `DownloadState` de
 * `@ycore/core-domain` en `main/features/downloads/repository.ts`.
 *
 * `speed`/`eta`/`percent` NO están aquí a propósito (ADR-0004, punto 3): son
 * derivados que cambian varias veces por segundo y viajan solo en el evento
 * de progreso, nunca se persisten.
 */
export const downloads = sqliteTable(
  'downloads',
  {
    id: text('id').primaryKey(),
    appId: integer('app_id').notNull(),
    status: text('status').notNull(),
    sourceUrl: text('source_url').notNull(),
    destinationPath: text('destination_path').notNull(),
    installPath: text('install_path').notNull(),
    bytesDownloaded: integer('bytes_downloaded').notNull().default(0),
    bytesTotal: integer('bytes_total'),
    etag: text('etag'),
    lastModified: text('last_modified'),
    expectedSha256: text('expected_sha256').notNull(),
    segmentIndex: integer('segment_index').notNull().default(0),
    segmentCount: integer('segment_count').notNull().default(1),
    errorCode: text('error_code'),
    retryCount: integer('retry_count').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    // Cero descargas duplicadas concurrentes (ADR-0004, punto 4): SQLite
    // rechaza la inserción de una segunda descarga activa del mismo appId,
    // sobrevive a un reinicio del proceso (a diferencia de un lock en memoria).
    uniqueIndex('downloads_active_app').on(table.appId).where(sql`${table.status} NOT IN ('done', 'failed')`),
  ],
);

/**
 * Pares clave-valor de configuración local persistente (Fase 5, ADR-0005).
 *
 * Hoy solo guarda `clientId` (UUID v4 generado en el primer arranque, para el
 * rollout determinista del update-worker — ADR-0005, punto 6: debe ser
 * estable entre arranques, o el cliente entraría y saldría del rollout cada
 * vez). Tabla genérica en vez de una columna dedicada porque es la forma
 * estándar de guardar ajustes sueltos sin migrar el esquema por cada uno.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
