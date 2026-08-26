/**
 * `handleAdminMaintenance` — `POST /v1/admin/maintenance`.
 *
 * Sirve para que la CLI `ycore` active o desactive el modo mantenimiento.
 * Cada cambio queda en `maintenance_log` con quién y por qué, porque cambia
 * el comportamiento de todos los clientes a la vez, en silencio.
 */

import { AdminMaintenanceSchema } from '@ycore/update-contract';
import { isValidAdminToken } from '../../http/auth.js';
import { badRequest, empty, json } from '../../http/responses.js';
import { writeMaintenanceFlag } from '../../data/config-kv.js';
import { insertMaintenanceLogEntry } from '../../data/maintenance-log-d1.js';
import type { WorkerEnv } from '../../env.js';

export async function handleAdminMaintenance(request: Request, env: WorkerEnv): Promise<Response> {
  if (!isValidAdminToken(request.headers.get('authorization'), env.YCORE_ADMIN_TOKEN)) return empty(401);

  const parsed = AdminMaintenanceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('invalid-payload', parsed.error.message);

  const { enabled, note, actor } = parsed.data;
  const now = new Date();

  const written = await writeMaintenanceFlag(env.CONFIG, enabled, note, now.toISOString());
  if (written.ok === false) return badRequest(written.error.code, written.error.detail ?? 'fallo al escribir KV');

  await insertMaintenanceLogEntry(env.DB, enabled, actor, note, now.toISOString());
  return json({ ok: true });
}
