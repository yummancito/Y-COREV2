/**
 * `downloadToFile` y `downloadJson` — I/O de red de la feature Updates.
 *
 * Sirve para bajar el instalador completo y el `manifest.json` firmado desde
 * las URLs firmadas que devuelve `/v1/check`. A diferencia del motor de
 * descargas de juegos (`main/features/downloads`), aquí no hay reanudación
 * por `Range`: el instalador de la propia app es un archivo de tamaño
 * moderado y, si la descarga falla a mitad, `checkNow()` se reintenta en el
 * siguiente ciclo con una URL firmada nueva — no vale la pena la complejidad
 * de una descarga diferencial resumible para este caso (ver decisions.md:
 * el diferencial por blockmap queda fuera de esta iteración).
 */

import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { err, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';

/**
 * Descarga `url` completa a `destinationPath`, sobrescribiendo si ya existía.
 *
 * @returns `ok(undefined)` si el archivo quedó escrito por completo, o
 *   `AppError` `net.unreachable`/`io.failed` si algo falló.
 */
export async function downloadToFile(url: string, destinationPath: string): Promise<Result<void, AppError>> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'net.unreachable', retriable: true });
  }

  if (!response.ok || response.body === null) {
    return err(appError('net.unreachable', { retriable: response.status >= 500, context: { url, status: response.status } }));
  }

  try {
    // `response.body` (undici) es un async iterable de `Uint8Array` en
    // runtime — `Readable.from` lo consume igual que cualquier otro. Se
    // castea a `AsyncIterable<Uint8Array>` (no a `ReadableStream`, cuya forma
    // exacta varía según si TS resuelve lib DOM en este árbol) para que el
    // cast sea válido bajo cualquier resolución de tipos.
    await pipeline(Readable.from(response.body as unknown as AsyncIterable<Uint8Array>), createWriteStream(destinationPath));
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
  return ok(undefined);
}

/**
 * Descarga `url` y la parsea como JSON crudo (`unknown`) — el llamador la
 * valida con el schema Zod correspondiente (`ManifestSchema`).
 *
 * @returns El JSON parseado, o `AppError` `net.unreachable` si la request
 *   falla o el body no es JSON válido.
 */
export async function downloadJson(url: string): Promise<Result<unknown, AppError>> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'net.unreachable', retriable: true });
  }

  if (!response.ok) {
    return err(appError('net.unreachable', { retriable: response.status >= 500, context: { url, status: response.status } }));
  }

  try {
    return ok(await response.json());
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'unknown' });
  }
}
