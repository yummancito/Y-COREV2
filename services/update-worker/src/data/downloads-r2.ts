/**
 * `fetchReleaseObject` — obtiene un objeto de R2 para servirlo como descarga.
 *
 * Sirve como el único lugar que toca el binding `RELEASES`. El bucket es
 * privado (roadmap C.3): la única forma de llegar aquí es haber pasado ya
 * por `verifyDownloadSignature` en la ruta. Pasa el `range` a través para
 * que la descarga diferencial por blockmap (ADR-0003) funcione — no hace
 * streaming completo si el cliente solo pidió un rango de bytes.
 */

import { err, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';

export interface ReleaseObject {
  readonly body: ReadableStream;
  readonly size: number;
  /** El rango pedido por el cliente, si vino uno válido — no el que R2 reporta internamente (que siempre existe). */
  readonly requestedRange: R2Range | undefined;
}

/**
 * Lee un objeto del bucket `RELEASES`, con soporte de `Range` opcional.
 *
 * @param r2 - El binding de R2.
 * @param key - Clave del objeto (p. ej. `releases/5.1.0/Setup.exe`).
 * @param rangeHeader - El valor crudo de la cabecera `Range` del cliente, si vino.
 * @returns El objeto (con su rango, si se pidió), o `AppError` `not-found`
 *   si la clave no existe en el bucket.
 */
export async function fetchReleaseObject(r2: R2Bucket, key: string, rangeHeader: string | null): Promise<Result<ReleaseObject, AppError>> {
  try {
    const range = parseRangeHeader(rangeHeader);
    const object = await (range === undefined ? r2.get(key) : r2.get(key, { range }));
    if (object === null) return err(appError('not-found', { context: { key } }));

    return ok({ body: object.body, size: object.size, requestedRange: range });
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
}

/** Convierte una cabecera `Range: bytes=N-` (formato simple, un solo rango) al formato que espera R2. */
function parseRangeHeader(rangeHeader: string | null): R2Range | undefined {
  if (rangeHeader === null) return undefined;
  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
  if (match === null) return undefined;

  const offset = Number.parseInt(match[1]!, 10);
  const endStr = match[2];
  if (endStr === undefined || endStr === '') return { offset };
  return { offset, length: Number.parseInt(endStr, 10) - offset + 1 };
}
