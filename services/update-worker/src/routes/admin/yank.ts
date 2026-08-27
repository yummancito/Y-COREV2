/**
 * `handleAdminYank` — `POST /v1/admin/yank`.
 *
 * Sirve para retirar una release ya publicada sin borrar su historial: deja
 * de ofrecerse en `/v1/check` (ADR-0005, punto 5: la CLI `ycore` cubre
 * rollout, yank, block, maintenance y stats).
 */

import { AdminYankSchema } from '@ycore/update-contract';
import { isValidAdminToken } from '../../http/auth.js';
import { badRequest, empty, json } from '../../http/responses.js';
import { yankRelease } from '../../data/releases-d1.js';
import { insertAdminActionLogEntry } from '../../data/admin-actions-log-d1.js';
import type { WorkerEnv } from '../../env.js';

export async function handleAdminYank(request: Request, env: WorkerEnv): Promise<Response> {
  if (!isValidAdminToken(request.headers.get('authorization'), env.YCORE_ADMIN_TOKEN)) return empty(401);

  const parsed = AdminYankSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('invalid-payload', parsed.error.message);

  const { version, actor } = parsed.data;

  const yanked = await yankRelease(env.DB, version);
  if (yanked.ok === false) return badRequest(yanked.error.code, yanked.error.detail ?? 'fallo al retirar la release');

  await insertAdminActionLogEntry(env.DB, {
    action: 'yank',
    version,
    channel: null,
    actor,
    detail: null,
    at: new Date().toISOString(),
  });

  return json({ ok: true });
}
