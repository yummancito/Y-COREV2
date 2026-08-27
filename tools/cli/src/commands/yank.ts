/**
 * `ycore yank` — retira una release publicada sin borrar su historial.
 *
 * Sirve para llamar a `POST /v1/admin/yank` (ADR-0005, punto 5): la versión
 * deja de ofrecerse en `/v1/check` inmediatamente, pero la fila sigue en
 * `releases` (`yanked = 1`) para auditoría.
 */

import { AdminYankSchema } from '@ycore/update-contract';
import { postAdmin } from '../admin-client.js';
import { readCliConfig } from '../cli-config.js';
import { parseFlags, requireString } from '../parse-flags.js';

export async function runYank(args: readonly string[]): Promise<void> {
  const flags = parseFlags(args);
  const config = readCliConfig();

  const payload = AdminYankSchema.parse({
    version: requireString(flags, 'version'),
    actor: requireString(flags, 'actor'),
  });

  await postAdmin(config.baseUrl, '/v1/admin/yank', config.adminToken, payload);
  console.log(`OK: release ${payload.version} retirada.`);
}
