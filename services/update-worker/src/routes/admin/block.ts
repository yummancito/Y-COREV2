/**
 * `handleAdminBlock` — `POST /v1/admin/block`.
 *
 * Sirve como kill-switch: el cliente en la versión bloqueada recibe
 * `status: "blocked"` en `/v1/check`, incluso en modo mantenimiento — el
 * bloqueo pesa más (ADR-0005, decisión explícita en `decideCheckResponse`).
 */

import { AdminBlockSchema } from '@ycore/update-contract';
import { isValidAdminToken } from '../../http/auth.js';
import { badRequest, empty, json } from '../../http/responses.js';
import { writeBlockedVersion } from '../../data/config-kv.js';
import { insertAdminActionLogEntry } from '../../data/admin-actions-log-d1.js';
import type { WorkerEnv } from '../../env.js';

export async function handleAdminBlock(request: Request, env: WorkerEnv): Promise<Response> {
  if (!isValidAdminToken(request.headers.get('authorization'), env.YCORE_ADMIN_TOKEN)) return empty(401);

  const parsed = AdminBlockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('invalid-payload', parsed.error.message);

  const { version, reason, forceTo, actor } = parsed.data;

  const written = await writeBlockedVersion(env.CONFIG, version, reason, forceTo);
  if (written.ok === false) return badRequest(written.error.code, written.error.detail ?? 'fallo al escribir el bloqueo');

  await insertAdminActionLogEntry(env.DB, {
    action: 'block',
    version,
    channel: null,
    actor,
    detail: reason,
    at: new Date().toISOString(),
  });

  return json({ ok: true });
}
