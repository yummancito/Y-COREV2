/**
 * Acceso a la tabla D1 `releases` (roadmap C.3, migración `0001_initial.sql`).
 *
 * Sirve como el único lugar que ejecuta SQL contra `releases`. Siempre con
 * `prepare(...).bind(...)` parametrizado (nunca concatenación de strings —
 * es la única superficie de inyección del servicio, ADR-0005 punto 3.a), y
 * el resultado siempre se valida con Zod antes de tocarlo: D1 no tiene
 * tipos, una columna renombrada a mano no la detecta el compilador.
 */

import { z } from 'zod';
import { err, ok, type Result } from '@ycore/result';
import { fromUnknown, type AppError } from '@ycore/result/app-error';
import type { ReleaseRecord } from '../domain/release-record.js';

const ReleaseRowSchema = z.object({
  version: z.string(),
  channel: z.string(),
  r2_key: z.string(),
  blockmap_key: z.string().nullable(),
  size: z.number().int(),
  sha512: z.string(),
  blockmap_sha512: z.string().nullable(),
  estimated_delta_size: z.number().int().nullable(),
  notes_json: z.string(),
  mandatory: z.number().int(),
  published_at: z.string(),
  yanked: z.number().int(),
});

function rowToRecord(row: z.infer<typeof ReleaseRowSchema>): ReleaseRecord {
  return {
    version: row.version,
    channel: row.channel,
    r2Key: row.r2_key,
    blockmapKey: row.blockmap_key,
    size: row.size,
    sha512: row.sha512,
    blockmapSha512: row.blockmap_sha512,
    estimatedDeltaSize: row.estimated_delta_size,
    notes: JSON.parse(row.notes_json) as { es: string; en: string },
    mandatory: row.mandatory === 1,
    publishedAt: row.published_at,
    yanked: row.yanked === 1,
  };
}

/**
 * Busca la última release no retirada (`yanked = 0`) de un canal, por fecha
 * de publicación.
 *
 * @returns `ok(null)` si no hay ninguna release en ese canal (no es un
 *   error: significa que todavía no se publicó nada ahí).
 */
export async function findLatestRelease(db: D1Database, channel: string): Promise<Result<ReleaseRecord | null, AppError>> {
  try {
    const row = await db
      .prepare('SELECT * FROM releases WHERE channel = ? AND yanked = 0 ORDER BY published_at DESC LIMIT 1')
      .bind(channel)
      .first();
    if (row === null) return ok(null);

    const parsed = ReleaseRowSchema.safeParse(row);
    if (!parsed.success) return err({ ...fromUnknown(parsed.error), code: 'unknown' });
    return ok(rowToRecord(parsed.data));
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
}

/** Input para publicar una release nueva — ver `POST /v1/admin/release`. */
export interface InsertReleaseInput {
  readonly version: string;
  readonly channel: string;
  readonly r2Key: string;
  readonly blockmapKey: string | null;
  readonly size: number;
  readonly sha512: string;
  readonly blockmapSha512: string | null;
  readonly estimatedDeltaSize: number | null;
  readonly notes: { readonly es: string; readonly en: string };
  readonly mandatory: boolean;
  readonly publishedAt: string;
}

/** Inserta una release nueva. La clave primaria es `version`, así que republicar la misma versión falla. */
export async function insertRelease(db: D1Database, input: InsertReleaseInput): Promise<Result<void, AppError>> {
  try {
    await db
      .prepare(
        `INSERT INTO releases
          (version, channel, r2_key, blockmap_key, size, sha512, blockmap_sha512, estimated_delta_size, notes_json, mandatory, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.version,
        input.channel,
        input.r2Key,
        input.blockmapKey,
        input.size,
        input.sha512,
        input.blockmapSha512,
        input.estimatedDeltaSize,
        JSON.stringify(input.notes),
        input.mandatory ? 1 : 0,
        input.publishedAt,
      )
      .run();
    return ok(undefined);
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
}

/** Marca una release como retirada (`yank`): deja de ofrecerse, sin borrar el historial. */
export async function yankRelease(db: D1Database, version: string): Promise<Result<void, AppError>> {
  try {
    await db.prepare('UPDATE releases SET yanked = 1 WHERE version = ?').bind(version).run();
    return ok(undefined);
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
}
