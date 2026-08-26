/**
 * `checkForUpdate` — consulta `GET /v1/check` y decide qué hacer con la respuesta (ADR-0003).
 *
 * Sirve como la única forma en que la app pregunta si hay una actualización.
 * La regla dura del ADR: **cualquier fallo — de red, de timeout, de status
 * HTTP, o de validación contra `CheckResponseSchema` — se trata como
 * `up-to-date` en silencio.** El usuario nunca ve un error de actualización;
 * si el servidor está en modo mantenimiento, la respuesta es indistinguible
 * de estar al día, así que este cliente ni siquiera necesita saber que existe
 * un modo mantenimiento.
 */

import { CheckResponseSchema, type CheckRequest, type CheckResponse } from '@ycore/update-contract';

const DEFAULT_CHECK_AGAIN_SECONDS = 21600;
const DEFAULT_TIMEOUT_MS = 10_000;

/** La respuesta "silenciosa" ante cualquier fallo — nunca se distingue de un fallo real de red. */
const SILENT_UP_TO_DATE: CheckResponse = { status: 'up-to-date', checkAgainInSeconds: DEFAULT_CHECK_AGAIN_SECONDS };

/** Lo que necesita `checkForUpdate` para armar la request — no incluye el HMAC, eso lo calcula `signClientRequest`. */
export interface CheckClientInput extends CheckRequest {
  readonly signature: string;
}

/**
 * Consulta el endpoint de actualizaciones.
 *
 * @param baseUrl - La URL base del Worker (p. ej. `https://updates.y-core.app`).
 * @param input - Los datos del cliente, ya firmados con `X-YCore-Signature`.
 * @param timeoutMs - Cuánto esperar antes de abandonar como `up-to-date`.
 * @returns Siempre una `CheckResponse` válida — nunca un error. Un fallo de
 *   red, un timeout, un status HTTP que no sea 200, o un body que no valide
 *   contra `CheckResponseSchema`, todos producen `SILENT_UP_TO_DATE`.
 */
export async function checkForUpdate(baseUrl: string, input: CheckClientInput, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<CheckResponse> {
  const url = new URL('/v1/check', baseUrl);
  url.searchParams.set('version', input.version);
  url.searchParams.set('channel', input.channel);
  url.searchParams.set('platform', input.platform);
  url.searchParams.set('arch', input.arch);
  url.searchParams.set('clientId', input.clientId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { 'x-ycore-signature': input.signature },
      signal: controller.signal,
    });
    if (!response.ok) return SILENT_UP_TO_DATE;

    const body: unknown = await response.json();
    const parsed = CheckResponseSchema.safeParse(body);
    return parsed.success ? parsed.data : SILENT_UP_TO_DATE;
  } catch {
    return SILENT_UP_TO_DATE;
  } finally {
    clearTimeout(timeout);
  }
}
