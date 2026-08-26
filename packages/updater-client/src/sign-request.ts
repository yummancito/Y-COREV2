/**
 * `signCheckRequest` — calcula `X-YCore-Signature` para una request a `/v1/check`.
 *
 * Sirve como el lado cliente del HMAC anti-scraping (ADR-0005, punto 6):
 * **esto no es autenticación real** — el secreto está embebido en el binario
 * de la app y cualquiera con un desensamblador lo extrae. Su único propósito
 * es que un scraper trivial no funcione sin haber mirado dentro del `.exe`.
 * La misma fórmula exacta que valida `services/update-worker/src/http/auth.ts`.
 */

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Firma los datos de una request de `/v1/check`.
 *
 * @param secret - El secreto compartido embebido en el binario (`YCORE_CLIENT_SECRET`).
 * @param clientId - UUID v4 local y estable del cliente.
 * @param version - Versión instalada actualmente.
 * @param channel - Canal de actualizaciones suscrito.
 * @returns El valor exacto para la cabecera `X-YCore-Signature`.
 */
export async function signCheckRequest(secret: string, clientId: string, version: string, channel: string): Promise<string> {
  return hmacSha256Hex(secret, `${clientId}${version}${channel}`);
}
