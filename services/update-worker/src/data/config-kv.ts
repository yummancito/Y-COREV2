/**
 * `readYCoreConfig` y `writeMaintenanceFlag` — acceso a `YCORE_CONFIG` en KV (roadmap C.3).
 *
 * Sirve como el único lugar que toca el binding `CONFIG`. Lee con Zod
 * (nunca confía en que el JSON guardado tiene la forma esperada — alguien
 * pudo escribirlo a mano en el dashboard de Cloudflare) y devuelve
 * `Result<T, AppError>`, nunca lanza (ADR-0005, punto 4: `data/*.ts` habla
 * con KV/D1/R2, terceros que lanzan, y traduce a `Result`).
 */

import { z } from 'zod';
import { err, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';
import type { YCoreConfig } from '../domain/config.js';

const CONFIG_KEY = 'YCORE_CONFIG';

const ChannelConfigSchema = z.object({ latest: z.string(), rollout: z.number().int().min(0).max(100), minSupported: z.string() });
const BlockedVersionSchema = z.object({ reason: z.string(), forceTo: z.string() });

const YCoreConfigSchema = z.object({
  maintenance: z.object({ enabled: z.boolean(), since: z.string().nullable(), note: z.string() }),
  channels: z.record(z.string(), ChannelConfigSchema),
  blocked: z.record(z.string(), BlockedVersionSchema),
  checkIntervalSeconds: z.number().int().positive(),
});

/**
 * Lee y valida `YCORE_CONFIG` de KV.
 *
 * @returns El config ya validado, o `AppError` `not-found` si la clave no
 *   existe, o `unknown` si el JSON guardado no tiene la forma esperada.
 */
export async function readYCoreConfig(kv: KVNamespace): Promise<Result<YCoreConfig, AppError>> {
  let raw: string | null;
  try {
    raw = await kv.get(CONFIG_KEY);
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }

  if (raw === null) return err(appError('not-found', { context: { key: CONFIG_KEY } }));

  const parsed = YCoreConfigSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return err(appError('unknown', { detail: `YCORE_CONFIG en KV no tiene la forma esperada: ${parsed.error.message}` }));
  }
  return ok(parsed.data);
}

/**
 * Activa o desactiva el modo mantenimiento, sin tocar el resto del config.
 *
 * @param kv - El binding de KV.
 * @param enabled - `true` para activar el modo mantenimiento silencioso.
 * @param note - Motivo, para el registro de auditoría (lo escribe quien llama en D1).
 * @param nowIso - Fecha ISO 8601 actual (inyectada).
 * @returns `ok(undefined)` si se escribió, o el `AppError` de leer/escribir KV.
 */
export async function writeMaintenanceFlag(
  kv: KVNamespace,
  enabled: boolean,
  note: string,
  nowIso: string,
): Promise<Result<void, AppError>> {
  const current = await readYCoreConfig(kv);
  if (current.ok === false) return current;

  const next: YCoreConfig = {
    ...current.value,
    maintenance: { enabled, since: enabled ? nowIso : null, note },
  };

  try {
    await kv.put(CONFIG_KEY, JSON.stringify(next));
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
  return ok(undefined);
}
