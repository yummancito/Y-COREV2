/**
 * `handleCheck` — `GET /v1/check`.
 *
 * Sirve como el único punto donde se traduce el `Result` del dominio a una
 * `Response` HTTP (ADR-0005, punto 4). Cualquier fallo de validación de
 * input, o de lectura de KV/D1, se traduce a `up-to-date` en silencio — un
 * `400`/`500` aquí solo le confirmaría a un scraper qué parámetros probó
 * bien, y al cliente legítimo no le sirve saberlo (ADR-0003).
 */

import { CheckRequestSchema, type CheckResponse } from '@ycore/update-contract';
import { isValidClientSignature } from '../http/auth.js';
import { json } from '../http/responses.js';
import { readYCoreConfig } from '../data/config-kv.js';
import { findLatestRelease } from '../data/releases-d1.js';
import { recordCheckOutcome } from '../data/stats-d1.js';
import { decideCheckResponse } from '../domain/decide.js';
import type { WorkerEnv } from '../env.js';

const FALLBACK_CHECK_INTERVAL_SECONDS = 21600;
const UP_TO_DATE: CheckResponse = { status: 'up-to-date', checkAgainInSeconds: FALLBACK_CHECK_INTERVAL_SECONDS };

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Encapsula "algo salió mal o el input no es válido": siempre responde up-to-date en silencio. */
async function respondUpToDateAndCount(env: WorkerEnv, version: string, channel: string, now: Date): Promise<Response> {
  await recordCheckOutcome(env.DB, todayIso(now), version, channel, 'rejected');
  return json(UP_TO_DATE);
}

export async function handleCheck(request: Request, env: WorkerEnv): Promise<Response> {
  const now = new Date();
  const url = new URL(request.url);
  const parsedRequest = CheckRequestSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsedRequest.success) {
    return respondUpToDateAndCount(env, url.searchParams.get('version') ?? 'unknown', url.searchParams.get('channel') ?? 'unknown', now);
  }
  const { version, channel, clientId } = parsedRequest.data;

  const signatureHeader = request.headers.get('x-ycore-signature');
  const signatureValid = await isValidClientSignature(signatureHeader, env.YCORE_CLIENT_SECRET, clientId, version, channel);
  if (!signatureValid) return respondUpToDateAndCount(env, version, channel, now);

  const config = await readYCoreConfig(env.CONFIG);
  if (config.ok === false) return respondUpToDateAndCount(env, version, channel, now);

  const latestRelease = await findLatestRelease(env.DB, channel);
  if (latestRelease.ok === false) return respondUpToDateAndCount(env, version, channel, now);

  const response = await decideCheckResponse(
    { clientVersion: version, channel, clientId, config: config.value, latestRelease: latestRelease.value },
    env.YCORE_CLIENT_SECRET,
    Math.floor(now.getTime() / 1000),
  );

  await recordCheckOutcome(env.DB, todayIso(now), version, channel, response.status);
  return json(response);
}
