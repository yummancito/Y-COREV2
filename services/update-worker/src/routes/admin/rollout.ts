/**
 * `handleAdminRollout` — `POST /v1/admin/rollout`.
 *
 * Sirve para cambiar el porcentaje de rollout de un canal sin publicar una
 * release nueva — p. ej. subir de 10% a 50% tras confirmar que no hay
 * incidencias (ADR-0005, punto 5).
 */

import { AdminRolloutSchema } from '@ycore/update-contract';
import { isValidAdminToken } from '../../http/auth.js';
import { badRequest, empty, json } from '../../http/responses.js';
import { writeChannelRollout } from '../../data/config-kv.js';
import { insertAdminActionLogEntry } from '../../data/admin-actions-log-d1.js';
import type { WorkerEnv } from '../../env.js';

export async function handleAdminRollout(request: Request, env: WorkerEnv): Promise<Response> {
  if (!isValidAdminToken(request.headers.get('authorization'), env.YCORE_ADMIN_TOKEN)) return empty(401);

  const parsed = AdminRolloutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('invalid-payload', parsed.error.message);

  const { channel, rollout, actor } = parsed.data;

  const written = await writeChannelRollout(env.CONFIG, channel, rollout);
  if (written.ok === false) return badRequest(written.error.code, written.error.detail ?? 'fallo al escribir el rollout');

  await insertAdminActionLogEntry(env.DB, {
    action: 'rollout',
    version: null,
    channel,
    actor,
    detail: `rollout=${rollout}`,
    at: new Date().toISOString(),
  });

  return json({ ok: true });
}
