/**
 * `handleAdminStats` — `GET /v1/admin/stats?days=N`.
 *
 * Sirve para que la CLI `ycore stats` muestre cuántos clientes comprobaron
 * qué en los últimos `N` días — el agregado sin PII de `check_stats`
 * (ADR-0005, sección "cicatrices del v1": "cero observabilidad de quién
 * recibía qué").
 */

import { isValidAdminToken } from '../../http/auth.js';
import { empty, json } from '../../http/responses.js';
import { readRecentStats } from '../../data/stats-d1.js';
import type { WorkerEnv } from '../../env.js';

const DEFAULT_DAYS = 7;

function dayNDaysAgoIso(days: number, now: Date): string {
  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() - days);
  return target.toISOString().slice(0, 10);
}

export async function handleAdminStats(request: Request, env: WorkerEnv): Promise<Response> {
  if (!isValidAdminToken(request.headers.get('authorization'), env.YCORE_ADMIN_TOKEN)) return empty(401);

  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const days = daysParam === null ? DEFAULT_DAYS : Number.parseInt(daysParam, 10);

  const stats = await readRecentStats(env.DB, dayNDaysAgoIso(Number.isNaN(days) ? DEFAULT_DAYS : days, new Date()));
  if (stats.ok === false) return json({ error: stats.error.code }, 500);

  return json({ stats: stats.value });
}
