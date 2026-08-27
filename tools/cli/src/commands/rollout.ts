/**
 * `ycore rollout` — cambia el porcentaje de rollout de un canal, sin publicar
 * una release nueva.
 *
 * Sirve para llamar a `POST /v1/admin/rollout` (ADR-0005, punto 5) — el uso
 * típico es subir el rollout de una release ya publicada (10% -> 50% -> 100%)
 * tras confirmar que no hay incidencias.
 */

import { AdminRolloutSchema } from '@ycore/update-contract';
import { postAdmin } from '../admin-client.js';
import { readCliConfig } from '../cli-config.js';
import { parseFlags, requireString, requireNumber } from '../parse-flags.js';

export async function runRollout(args: readonly string[]): Promise<void> {
  const flags = parseFlags(args);
  const config = readCliConfig();

  const payload = AdminRolloutSchema.parse({
    channel: requireString(flags, 'channel'),
    rollout: requireNumber(flags, 'rollout'),
    actor: requireString(flags, 'actor'),
  });

  await postAdmin(config.baseUrl, '/v1/admin/rollout', config.adminToken, payload);
  console.log(`OK: rollout del canal ${payload.channel} en ${payload.rollout}%.`);
}
