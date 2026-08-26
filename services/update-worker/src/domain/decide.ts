/**
 * `decideCheckResponse` — el corazón del Worker: junta config + release + rollout
 * y produce exactamente una de las tres respuestas de `/v1/check` (ADR-0003).
 *
 * Sirve como el único lugar que decide "qué le toca a este cliente" — todo lo
 * demás (`routes/check.ts`) es leer datos y llamar a esto. Puro salvo por la
 * firma de las URLs de descarga (Web Crypto async, sin bindings): no toca
 * KV/D1/R2 directamente, recibe todo lo que necesita ya leído.
 */

import { CheckResponseSchema, type CheckResponse } from '@ycore/update-contract';
import { isInRollout } from './rollout.js';
import { signDownloadUrl, type SignedDownloadParams } from './signed-url.js';
import type { YCoreConfig } from './config.js';
import type { ReleaseRecord } from './release-record.js';

/** Arma la URL de `/v1/download` con los parámetros de la firma, incluido `clientId` (necesario para re-verificar). */
function buildDownloadUrl(version: string, kind: 'full' | 'blockmap', clientId: string, signed: SignedDownloadParams): string {
  const params = new URLSearchParams({
    t: String(signed.expiresAtSeconds),
    sig: signed.signature,
    clientId,
  });
  return `/v1/download/${version}/${kind}?${params.toString()}`;
}

const UP_TO_DATE_STATUS = 'up-to-date' as const;

/** Input real para decidir: la request del cliente + todo lo leído de KV/D1. */
export interface DecideInput {
  readonly clientVersion: string;
  readonly channel: string;
  readonly clientId: string;
  readonly config: YCoreConfig;
  readonly latestRelease: ReleaseRecord | null;
}

function upToDate(config: YCoreConfig): CheckResponse {
  return { status: UP_TO_DATE_STATUS, checkAgainInSeconds: config.checkIntervalSeconds };
}

/**
 * Decide la respuesta de `/v1/check` para un cliente concreto.
 *
 * @param input - La request del cliente y el estado ya leído de KV/D1.
 * @param secret - Secreto para firmar las URLs de descarga (si aplica).
 * @param nowSeconds - Marca de tiempo actual en segundos (inyectada para tests).
 * @returns Una `CheckResponse` que siempre valida contra `CheckResponseSchema`
 *   (se verifica en el propio código, no solo en tests: un bug aquí no puede
 *   producir una respuesta con forma inválida).
 */
export async function decideCheckResponse(input: DecideInput, secret: string, nowSeconds: number): Promise<CheckResponse> {
  const { clientVersion, channel, clientId, config, latestRelease } = input;

  const blocked = config.blocked[clientVersion];
  if (blocked !== undefined) {
    return CheckResponseSchema.parse({
      status: 'blocked',
      reason: blocked.reason,
      message: { es: 'Esta versión ya no es compatible.', en: 'This version is no longer supported.' },
      forceUpdateTo: blocked.forceTo,
    });
  }

  // Modo mantenimiento: respuesta indistinguible de "estás al día" (ADR-0003).
  // Se comprueba DESPUÉS del kill-switch a propósito: un binario tóxico sigue
  // siéndolo aunque el mantenimiento esté activo (ADR-0005, decisión explícita).
  if (config.maintenance.enabled) return upToDate(config);

  const channelConfig = config.channels[channel];
  if (channelConfig === undefined || latestRelease === null || latestRelease.yanked) return upToDate(config);
  if (latestRelease.version === clientVersion) return upToDate(config);

  const inRollout = await isInRollout(clientId, latestRelease.version, channelConfig.rollout);
  if (!inRollout) return upToDate(config);

  const artifactSigned = await signDownloadUrl(secret, latestRelease.r2Key, clientId, nowSeconds);
  const artifactUrl = buildDownloadUrl(latestRelease.version, 'full', clientId, artifactSigned);

  const delta =
    latestRelease.blockmapKey === null
      ? null
      : {
          fromVersion: clientVersion,
          blockmapUrl: await buildBlockmapUrl(secret, latestRelease, clientId, nowSeconds),
          estimatedSize: latestRelease.estimatedDeltaSize ?? latestRelease.size,
        };

  return CheckResponseSchema.parse({
    status: 'update-available',
    version: latestRelease.version,
    channel: latestRelease.channel,
    mandatory: latestRelease.mandatory,
    notes: latestRelease.notes,
    artifact: {
      kind: 'nsis',
      size: latestRelease.size,
      sha512: latestRelease.sha512,
      url: artifactUrl,
      urlExpiresAt: new Date(artifactSigned.expiresAtSeconds * 1000).toISOString(),
    },
    delta,
    checkAgainInSeconds: config.checkIntervalSeconds,
  });
}

async function buildBlockmapUrl(secret: string, release: ReleaseRecord, clientId: string, nowSeconds: number): Promise<string> {
  if (release.blockmapKey === null) throw new Error('buildBlockmapUrl llamado sin blockmapKey');
  const signed = await signDownloadUrl(secret, release.blockmapKey, clientId, nowSeconds);
  return buildDownloadUrl(release.version, 'blockmap', clientId, signed);
}
