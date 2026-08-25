/**
 * `IncrementalHasher` y `verifyFileSha256` — integridad de un archivo descargado (ADR-0004, punto 7).
 *
 * `IncrementalHasher` se alimenta con cada chunk mientras se escribe el
 * archivo a disco, para no tener que releerlo al terminar. `verifyFileSha256`
 * es el camino de respaldo: relee el archivo completo una vez, para el caso
 * en que la descarga se reanudó tras un reinicio del proceso y el hash
 * incremental se perdió (no es serializable) — ver ADR-0004, punto 7,
 * "Excepción, importante".
 */

import { createHash, type Hash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { err, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';

/** Envuelve un `Hash` de `node:crypto` para alimentarlo chunk a chunk sin releer el archivo. */
export class IncrementalHasher {
  private readonly hash: Hash = createHash('sha256');

  /** Añade un chunk al hash. Llamar en el mismo orden en que se escribe a disco. */
  update(chunk: Uint8Array): void {
    this.hash.update(chunk);
  }

  /** Cierra el hash y devuelve el dígesto en hexadecimal, listo para comparar con `expectedSha256`. */
  digestHex(): string {
    return this.hash.digest('hex');
  }
}

/**
 * Relee un archivo completo del disco y calcula su SHA-256.
 *
 * @param filePath - Ruta del archivo a verificar.
 * @returns El dígesto en hexadecimal, o `AppError` `io.failed` si no se pudo leer.
 */
export async function hashFileSha256(filePath: string): Promise<Result<string, AppError>> {
  const hash = createHash('sha256');
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
  return ok(hash.digest('hex'));
}

/**
 * Verifica que un archivo en disco coincide con el hash esperado.
 *
 * @param filePath - Ruta del archivo descargado.
 * @param expectedSha256 - El hash que se esperaba, en hexadecimal.
 * @returns `ok(undefined)` si coincide, `AppError` `download.integrity-mismatch`
 *   si no, o `io.failed` si el archivo no se pudo leer.
 */
export async function verifyFileSha256(filePath: string, expectedSha256: string): Promise<Result<void, AppError>> {
  const hashed = await hashFileSha256(filePath);
  if (hashed.ok === false) return hashed;

  if (hashed.value.toLowerCase() !== expectedSha256.toLowerCase()) {
    return err(
      appError('download.integrity-mismatch', {
        context: { expected: expectedSha256, actual: hashed.value },
      }),
    );
  }
  return ok(undefined);
}
