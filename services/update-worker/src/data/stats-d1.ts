/**
 * Acceso a la tabla D1 `check_stats` (roadmap C.3) — agregado sin PII de
 * cuántos clientes comprobaron qué, por día/versión/canal/resultado.
 *
 * Sirve para responder `GET /v1/admin/stats` y para dar visibilidad de
 * cuántos clientes siguen en versiones viejas — algo que el v1 no tenía
 * ("cero observabilidad de quién recibía qué", ADR-0005 sección "cicatrices
 * del v1"). Sin columna de cliente: `recordCheckOutcome` nunca recibe ni
 * guarda un `clientId`.
 */

import { z } from 'zod';
import { err, ok, type Result } from '@ycore/result';
import { fromUnknown, type AppError } from '@ycore/result/app-error';

/** Los resultados posibles de un `/v1/check`, para la columna `outcome`. */
export type CheckOutcome = 'up-to-date' | 'update-available' | 'blocked' | 'rejected';

/**
 * Suma 1 al contador `(day, version, channel, outcome)`. Se usa `INSERT ...
 * ON CONFLICT DO UPDATE` para que el agregado no requiera leer antes de
 * escribir.
 */
export async function recordCheckOutcome(
  db: D1Database,
  day: string,
  version: string,
  channel: string,
  outcome: CheckOutcome,
): Promise<Result<void, AppError>> {
  try {
    await db
      .prepare(
        `INSERT INTO check_stats (day, version, channel, outcome, count)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT (day, version, channel, outcome) DO UPDATE SET count = count + 1`,
      )
      .bind(day, version, channel, outcome)
      .run();
    return ok(undefined);
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
}

const StatsRowSchema = z.object({ day: z.string(), version: z.string(), channel: z.string(), outcome: z.string(), count: z.number().int() });

/** Una fila agregada de `check_stats`, tal como la devuelve `GET /v1/admin/stats`. */
export type StatsRow = z.infer<typeof StatsRowSchema>;

/** Lee las filas de `check_stats` de los últimos `days` días. */
export async function readRecentStats(db: D1Database, sinceDay: string): Promise<Result<StatsRow[], AppError>> {
  try {
    const { results } = await db.prepare('SELECT * FROM check_stats WHERE day >= ? ORDER BY day DESC').bind(sinceDay).all();

    const rows: StatsRow[] = [];
    for (const row of results) {
      const parsed = StatsRowSchema.safeParse(row);
      if (!parsed.success) return err({ ...fromUnknown(parsed.error), code: 'unknown' });
      rows.push(parsed.data);
    }
    return ok(rows);
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
}
