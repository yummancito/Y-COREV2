/**
 * `handleAdminRelease` — `POST /v1/admin/release`.
 *
 * Sirve para que el pipeline de CI publique una release nueva, después de
 * subir el instalador y el manifest **ya firmado** a R2 (ADR-0005, punto 5:
 * el Worker nunca firma, solo almacena y sirve). Inserta la fila en
 * `releases` y actualiza el `latest`/`rollout` del canal en KV.
 */

import { AdminReleaseSchema } from '@ycore/update-contract';
import { isValidAdminToken } from '../../http/auth.js';
import { badRequest, empty, json } from '../../http/responses.js';
import { readYCoreConfig } from '../../data/config-kv.js';
import { insertRelease } from '../../data/releases-d1.js';
import type { WorkerEnv } from '../../env.js';

export async function handleAdminRelease(request: Request, env: WorkerEnv): Promise<Response> {
  if (!isValidAdminToken(request.headers.get('authorization'), env.YCORE_ADMIN_TOKEN)) return empty(401);

  const parsed = AdminReleaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('invalid-payload', parsed.error.message);

  const config = await readYCoreConfig(env.CONFIG);
  if (config.ok === false) return badRequest(config.error.code, config.error.detail ?? 'fallo al leer KV');

  const { version, channel, rollout, r2Key, blockmapKey, manifestKey, size, sha512, blockmapSha512, estimatedDeltaSize, notes, mandatory } =
    parsed.data;

  const inserted = await insertRelease(env.DB, {
    version,
    channel,
    r2Key,
    blockmapKey,
    manifestKey,
    size,
    sha512,
    blockmapSha512,
    estimatedDeltaSize,
    notes,
    mandatory,
    publishedAt: new Date().toISOString(),
  });
  if (inserted.ok === false) return badRequest(inserted.error.code, inserted.error.detail ?? 'fallo al insertar en D1');

  const nextConfig = {
    ...config.value,
    channels: { ...config.value.channels, [channel]: { latest: version, rollout, minSupported: config.value.channels[channel]?.minSupported ?? version } },
  };
  await env.CONFIG.put('YCORE_CONFIG', JSON.stringify(nextConfig));

  return json({ ok: true });
}
