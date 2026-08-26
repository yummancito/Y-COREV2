/**
 * `signDownloadUrl` y `verifyDownloadSignature` — URLs firmadas de vida corta para R2.
 *
 * Sirve para que `/v1/check` pueda entregar de una vez una URL de descarga
 * lista para usar (ADR-0005, punto 7: no hay endpoint intermedio), y para
 * que `/v1/download` verifique esa firma antes de servir el objeto — el
 * bucket R2 es privado (roadmap C.3), así que la única forma de descargar
 * algo es con una firma válida y no caducada. HMAC-SHA256 sobre
 * `key|expiry|clientId`, TTL de 15 minutos (roadmap C.3).
 */

const DEFAULT_TTL_SECONDS = 15 * 60;

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function payloadFor(r2Key: string, expiresAtSeconds: number, clientId: string): string {
  return `${r2Key}|${expiresAtSeconds}|${clientId}`;
}

/** Los parámetros `t` (expiry) y `sig` (firma) de una URL de descarga firmada. */
export interface SignedDownloadParams {
  readonly expiresAtSeconds: number;
  readonly signature: string;
}

/**
 * Firma una clave de R2 para que sea descargable durante `ttlSeconds`.
 *
 * @param secret - Secreto compartido del Worker (`YCORE_CLIENT_SECRET` u otro dedicado).
 * @param r2Key - Clave del objeto en el bucket `RELEASES`.
 * @param clientId - El cliente para el que se firma (liga la URL a quien la pidió).
 * @param now - Marca de tiempo actual en segundos (inyectada para tests).
 * @param ttlSeconds - Cuánto dura la firma. 15 min por defecto (roadmap C.3).
 * @returns Los parámetros `t`/`sig` a anexar a la URL de `/v1/download`.
 */
export async function signDownloadUrl(
  secret: string,
  r2Key: string,
  clientId: string,
  now: number,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<SignedDownloadParams> {
  const expiresAtSeconds = now + ttlSeconds;
  const signature = await hmacSha256Hex(secret, payloadFor(r2Key, expiresAtSeconds, clientId));
  return { expiresAtSeconds, signature };
}

/**
 * Verifica que una firma de descarga es válida y no ha expirado.
 *
 * @param secret - El mismo secreto usado para firmar.
 * @param r2Key - La clave que el cliente pide descargar.
 * @param clientId - El cliente que la pide (debe coincidir con el que firmó).
 * @param params - `t`/`sig` recibidos en la query string.
 * @param now - Marca de tiempo actual en segundos (inyectada para tests).
 * @returns `true` solo si la firma es válida para exactamente esta
 *   combinación de `r2Key`+`clientId` y no ha expirado.
 */
export async function verifyDownloadSignature(
  secret: string,
  r2Key: string,
  clientId: string,
  params: SignedDownloadParams,
  now: number,
): Promise<boolean> {
  if (now > params.expiresAtSeconds) return false;
  const expected = await hmacSha256Hex(secret, payloadFor(r2Key, params.expiresAtSeconds, clientId));
  return timingSafeEqual(expected, params.signature);
}

/** Comparación en tiempo constante de dos strings hex de igual longitud esperada. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
