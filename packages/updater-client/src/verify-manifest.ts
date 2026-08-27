/**
 * `verifyManifestSignature` y `verifyArtifactSha512` — la cadena de confianza de una actualización (ADR-0003, ADR-0005).
 *
 * Sirve como la última defensa antes de ejecutar un instalador: el manifest
 * viene firmado con Ed25519 por el pipeline de CI (nunca por el Worker,
 * ADR-0005 punto 5), y el propio artefacto se verifica contra el SHA-512 que
 * el manifest firmado declara. Si cualquiera de las dos comprobaciones
 * falla, el archivo se descarta y **nunca se ejecuta nada**. Ni Cloudflare ni
 * el DNS pueden hacer que la app instale un binario que no fue firmado con la
 * clave privada real (que nunca sale de GitHub Secrets).
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { err, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';
import type { Manifest } from '@ycore/update-contract';

/** Los campos del manifest que participan en la firma — todo salvo `signature` en sí. */
function signedPayloadOf(manifest: Manifest): string {
  const rest: Record<string, unknown> = { ...manifest };
  delete rest['signature'];
  return JSON.stringify(rest);
}

/**
 * Verifica la firma Ed25519 de un manifest contra una clave pública embebida
 * en el binario.
 *
 * @param manifest - El manifest recibido (todavía no confiable).
 * @param publicKeysBase64 - Una o dos claves públicas Ed25519 aceptadas
 *   (roadmap C.6.5: el cliente acepta la actual y la siguiente, para poder
 *   rotar sin romper clientes viejos).
 * @returns `ok(undefined)` si la firma es válida contra **al menos una** de
 *   las claves, o `AppError` `download.signature-invalid` si no.
 */
export async function verifyManifestSignature(manifest: Manifest, publicKeysBase64: readonly string[]): Promise<Result<void, AppError>> {
  const payload = new TextEncoder().encode(signedPayloadOf(manifest));
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = Uint8Array.from(atob(manifest.signature), (char) => char.charCodeAt(0));
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'unknown' });
  }

  for (const publicKeyBase64 of publicKeysBase64) {
    const valid = await verifyWithKey(payload, signatureBytes, publicKeyBase64);
    if (valid) return ok(undefined);
  }
  return err(appError('unknown', { detail: 'firma Ed25519 del manifest inválida para todas las claves conocidas' }));
}

async function verifyWithKey(payload: Uint8Array, signature: Uint8Array, publicKeyBase64: string): Promise<boolean> {
  try {
    const keyBytes = Uint8Array.from(atob(publicKeyBase64), (char) => char.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'Ed25519' }, false, ['verify']);
    // `crypto.subtle.verify` con lib DOM presente exige `Uint8Array<ArrayBuffer>`
    // (nunca `SharedArrayBuffer`); `Uint8Array.from` en @types/node sin DOM
    // infiere `ArrayBufferLike`, más laxo. Son el mismo objeto en runtime — se
    // fuerza el tipo estricto para que el paquete typechequee igual con o sin
    // lib DOM en el tsconfig del consumidor (ver apps/desktop, que sí la tiene).
    const signatureBuffer = signature as Uint8Array<ArrayBuffer>;
    const payloadBuffer = payload as Uint8Array<ArrayBuffer>;
    return await crypto.subtle.verify('Ed25519', key, signatureBuffer, payloadBuffer);
  } catch {
    return false;
  }
}

/**
 * Calcula el SHA-512 de un archivo ya descargado y lo compara con el que
 * declara el manifest.
 *
 * @param filePath - Ruta del instalador descargado.
 * @param expectedSha512 - El hash que el manifest (ya verificado) declara.
 * @returns `ok(undefined)` si coincide, o `AppError` `download.integrity-mismatch`
 *   si no, o `io.failed` si el archivo no se pudo leer.
 */
export async function verifyArtifactSha512(filePath: string, expectedSha512: string): Promise<Result<void, AppError>> {
  const hash = createHash('sha512');
  try {
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }

  const actual = hash.digest('hex');
  if (actual.toLowerCase() !== expectedSha512.toLowerCase()) {
    return err(appError('download.integrity-mismatch', { context: { expected: expectedSha512, actual } }));
  }
  return ok(undefined);
}
