/**
 * `isValidAdminToken` y `isValidClientSignature` — las dos autenticaciones del Worker.
 *
 * Sirve para separar la auth "real" (el bearer de los endpoints admin, que sí
 * protege algo) de la auth "ofuscación" (el HMAC del cliente público, que no
 * protege nada por diseño — ADR-0005, punto 6: es anti-scraping, la
 * seguridad real es la firma Ed25519 del manifest). Documentarlas juntas,
 * pero como funciones separadas con nombres distintos, es a propósito: no
 * deben confundirse ni tratarse con el mismo nivel de confianza.
 */

const BEARER_PREFIX = 'Bearer ';

/** Compara dos strings de igual longitud esperada en tiempo constante. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Valida el bearer token de un endpoint `/v1/admin/*`.
 *
 * @param authorizationHeader - El valor crudo de la cabecera `Authorization`, o `null`.
 * @param expectedToken - El token configurado en `YCORE_ADMIN_TOKEN`.
 */
export function isValidAdminToken(authorizationHeader: string | null, expectedToken: string): boolean {
  if (authorizationHeader === null || !authorizationHeader.startsWith(BEARER_PREFIX)) return false;
  const token = authorizationHeader.slice(BEARER_PREFIX.length);
  return timingSafeEqual(token, expectedToken);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Valida `X-YCore-Signature` de una request de `/v1/check` (ADR-0005, punto 6).
 *
 * **Esto no es autenticación real**: el secreto está embebido en el binario
 * del cliente y cualquiera con un desensamblador lo extrae. Su único
 * propósito es que un scraper trivial (`curl` en bucle) no funcione sin
 * haber mirado dentro del `.exe`. La seguridad real de la cadena de
 * actualización es la firma Ed25519 del manifest, no esto.
 *
 * @returns `true` si el HMAC recibido coincide con el calculado sobre
 *   `clientId + version + channel`.
 */
export async function isValidClientSignature(
  signatureHeader: string | null,
  secret: string,
  clientId: string,
  version: string,
  channel: string,
): Promise<boolean> {
  if (signatureHeader === null) return false;
  const expected = await hmacSha256Hex(secret, `${clientId}${version}${channel}`);
  return timingSafeEqual(expected, signatureHeader);
}
