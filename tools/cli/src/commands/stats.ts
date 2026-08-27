/**
 * `ycore stats` — muestra el agregado de `check_stats` de los últimos N días.
 *
 * Sirve para llamar a `GET /v1/admin/stats?days=N` (ADR-0005, punto 5): "¿cuántos
 * clientes están en la versión X?", sin PII, para responder a la pregunta que
 * el v1 nunca pudo contestar (ver ADR-0005, "cicatrices del v1").
 */

import { getAdmin } from '../admin-client.js';
import { readCliConfig } from '../cli-config.js';
import { parseFlags } from '../parse-flags.js';

const DEFAULT_DAYS = 7;

export async function runStats(args: readonly string[]): Promise<void> {
  const flags = parseFlags(args);
  const config = readCliConfig();

  const daysFlag = flags['days'];
  const days = typeof daysFlag === 'string' ? daysFlag : String(DEFAULT_DAYS);

  const body = await getAdmin(config.baseUrl, `/v1/admin/stats?days=${encodeURIComponent(days)}`, config.adminToken);
  console.log(JSON.stringify(body, null, 2));
}
