/**
 * `ycore block` — kill-switch: bloquea una versión y fuerza la actualización.
 *
 * Sirve para llamar a `POST /v1/admin/block` (ADR-0005, punto 5). El cliente
 * en la versión bloqueada recibe `status: "blocked"` en `/v1/check`, incluso
 * en modo mantenimiento — el bloqueo pesa más (decisión explícita de
 * `decideCheckResponse`).
 */

import { AdminBlockSchema } from '@ycore/update-contract';
import { postAdmin } from '../admin-client.js';
import { readCliConfig } from '../cli-config.js';
import { parseFlags, requireString } from '../parse-flags.js';

export async function runBlock(args: readonly string[]): Promise<void> {
  const flags = parseFlags(args);
  const config = readCliConfig();

  const payload = AdminBlockSchema.parse({
    version: requireString(flags, 'version'),
    reason: requireString(flags, 'reason'),
    forceTo: requireString(flags, 'force-to'),
    actor: requireString(flags, 'actor'),
  });

  await postAdmin(config.baseUrl, '/v1/admin/block', config.adminToken, payload);
  console.log(`OK: versión ${payload.version} bloqueada, se fuerza a ${payload.forceTo}.`);
}
