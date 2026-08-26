/**
 * `computeRolloutBucket` — decide si un cliente entra en el rollout de una versión.
 *
 * Sirve para repartir una actualización de forma **determinista**: el mismo
 * `clientId` para la misma `version` siempre cae en el mismo bucket, así que
 * subir el `rollout` de 10% a 50% nunca saca a quien ya estaba dentro (ADR-0005,
 * punto 8, y roadmap C.4: "bucket = HMAC(clientId + version) mod 100"). Puro
 * en el sentido de que no toca KV/D1/R2 — solo depende de Web Crypto, que es
 * lo único de "I/O" que existe en `workerd` sin bindings, y que sí está
 * disponible en Node/tests vía `vitest-pool-workers`.
 *
 * El roadmap habla de "HMAC", pero aquí no hace falta una clave secreta: el
 * propósito es repartir de forma determinista y uniforme, no autenticar
 * nada (el cliente ya conoce su propio `clientId`). Un hash simple
 * (SHA-256 de `clientId + version`) da exactamente la misma propiedad de
 * determinismo con una superficie más simple — no hay clave que gestionar
 * ni que rotar para algo que no protege nada.
 */

const HASH_BYTE_MODULO = 100;

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Calcula el bucket (0-99) de un cliente para una versión dada.
 *
 * @param clientId - UUID v4 local y estable del cliente (nunca se persiste).
 * @param version - La versión candidata a repartir.
 * @returns Un entero determinista en `[0, 100)`: el mismo par
 *   `(clientId, version)` siempre produce el mismo bucket.
 */
export async function computeRolloutBucket(clientId: string, version: string): Promise<number> {
  const digestHex = await sha256Hex(`${clientId}:${version}`);
  // Se usan los primeros 8 hex (32 bits) del HMAC como entero para el módulo:
  // suficiente entropía para una distribución uniforme sobre 100 buckets, sin
  // tener que manejar BigInt para el hash completo de 256 bits.
  const firstBytesAsInt = Number.parseInt(digestHex.slice(0, 8), 16);
  return firstBytesAsInt % HASH_BYTE_MODULO;
}

/**
 * Decide si un cliente entra en un rollout dado, de forma determinista.
 *
 * @param clientId - UUID v4 local y estable del cliente.
 * @param version - La versión candidata.
 * @param rolloutPercent - Porcentaje de rollout configurado (0-100).
 * @returns `true` si el cliente debe recibir esta versión.
 */
export async function isInRollout(clientId: string, version: string, rolloutPercent: number): Promise<boolean> {
  if (rolloutPercent <= 0) return false;
  if (rolloutPercent >= 100) return true;
  const bucket = await computeRolloutBucket(clientId, version);
  return bucket < rolloutPercent;
}
