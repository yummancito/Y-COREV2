/**
 * `ycore release` — registra en el Worker una release ya subida a R2.
 *
 * Sirve para llamar a `POST /v1/admin/release` (ADR-0005, punto 5). **Esta
 * CLI nunca firma nada**: el manifest ya fue firmado con Ed25519 por el
 * pipeline de CI (`release-desktop.yml`) y el instalador + `.blockmap` +
 * manifest ya están en R2 antes de invocar este comando. `ycore release
 * publish` desde un portátil no puede publicar una release firmada por sí
 * solo — es intencional (ADR-0005, punto 5: "publicar una release es siempre
 * un tag de git que dispara el workflow").
 */

import { AdminReleaseSchema } from '@ycore/update-contract';
import { postAdmin } from '../admin-client.js';
import { readCliConfig } from '../cli-config.js';
import { parseFlags, requireString, requireNumber, readBoolean } from '../parse-flags.js';

function readNullableString(flags: Record<string, string | boolean>, key: string): string | null {
  const value = flags[key];
  return typeof value === 'string' ? value : null;
}

function readNullableNumber(flags: Record<string, string | boolean>, key: string): number | null {
  const value = flags[key];
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error(`--${key} debe ser un número, recibido "${value}".`);
  return parsed;
}

export async function runRelease(args: readonly string[]): Promise<void> {
  const flags = parseFlags(args);
  const config = readCliConfig();

  const payload = AdminReleaseSchema.parse({
    version: requireString(flags, 'version'),
    channel: requireString(flags, 'channel'),
    rollout: requireNumber(flags, 'rollout'),
    r2Key: requireString(flags, 'r2-key'),
    blockmapKey: readNullableString(flags, 'blockmap-key'),
    manifestKey: requireString(flags, 'manifest-key'),
    size: requireNumber(flags, 'size'),
    sha512: requireString(flags, 'sha512'),
    blockmapSha512: readNullableString(flags, 'blockmap-sha512'),
    estimatedDeltaSize: readNullableNumber(flags, 'estimated-delta-size'),
    notes: { es: requireString(flags, 'notes-es'), en: requireString(flags, 'notes-en') },
    mandatory: readBoolean(flags, 'mandatory'),
  });

  await postAdmin(config.baseUrl, '/v1/admin/release', config.adminToken, payload);
  console.log(`OK: release ${payload.version} (${payload.channel}) publicada con rollout ${payload.rollout}%.`);
}
