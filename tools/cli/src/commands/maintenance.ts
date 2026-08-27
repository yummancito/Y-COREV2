/**
 * `ycore maintenance` — activa o desactiva el modo mantenimiento silencioso.
 *
 * Sirve para llamar a `POST /v1/admin/maintenance` (ADR-0005, punto 5). En
 * modo mantenimiento, el Worker responde a todos los clientes exactamente
 * igual que "estás al día" (ADR-0003), así que este comando cambia el
 * comportamiento de todos los clientes a la vez, en silencio — por eso exige
 * `--note` y `--actor`, que quedan en `maintenance_log`.
 */

import { AdminMaintenanceSchema } from '@ycore/update-contract';
import { postAdmin } from '../admin-client.js';
import { readCliConfig } from '../cli-config.js';
import { parseFlags, requireString, readBoolean } from '../parse-flags.js';

/** Decide `enabled` exigiendo exactamente uno de `--on`/`--off` — sin default implícito para un cambio que afecta a todos los clientes a la vez. */
function requireOnOrOff(flags: Record<string, string | boolean>): boolean {
  const on = readBoolean(flags, 'on');
  const off = readBoolean(flags, 'off');
  if (on === off) throw new Error('Pasa exactamente uno de --on o --off.');
  return on;
}

export async function runMaintenance(args: readonly string[]): Promise<void> {
  const flags = parseFlags(args);
  const config = readCliConfig();

  const payload = AdminMaintenanceSchema.parse({
    enabled: requireOnOrOff(flags),
    note: requireString(flags, 'note'),
    actor: requireString(flags, 'actor'),
  });

  await postAdmin(config.baseUrl, '/v1/admin/maintenance', config.adminToken, payload);
  console.log(`OK: mantenimiento ${payload.enabled ? 'activado' : 'desactivado'}.`);
}
