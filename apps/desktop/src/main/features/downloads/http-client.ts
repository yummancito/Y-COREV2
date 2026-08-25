/**
 * `openDownloadStream` — abre la conexión HTTP de una descarga, con reanudación por Range.
 *
 * Sirve como el único lugar de la feature que habla HTTP (ADR-0004, punto 1):
 * usa `fetch` global (undici, ya en Node/Electron 33 — cero dependencias
 * nuevas). Si hay progreso previo, pide un `Range` con `If-Range` para que el
 * servidor solo reanude si el recurso no cambió; si el servidor no soporta
 * Range (responde `200` en vez de `206`), avisa al llamador para que trunque
 * el archivo parcial y empiece de cero — **nunca concatena una respuesta
 * completa detrás de bytes ya escritos**.
 */

import { err, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';

/** Lo que se sabía de la descarga antes de (re)conectar. */
export interface ResumeInfo {
  readonly bytesDownloaded: number;
  readonly etag: string | null;
  readonly lastModified: string | null;
}

/** El resultado de abrir la conexión: el stream a consumir y si hace falta truncar antes. */
export interface DownloadStream {
  /** El cuerpo de la respuesta, listo para volcarse a disco. */
  readonly body: ReadableStream<Uint8Array>;
  /** `true` si el servidor no soportó (o invalidó) la reanudación: hay que truncar y empezar de 0. */
  readonly mustRestartFromZero: boolean;
  /** `Content-Length` de la respuesta. Si `mustRestartFromZero`, es el tamaño total del archivo. */
  readonly bytesTotal: number | null;
  readonly etag: string | null;
  readonly lastModified: string | null;
}

function buildHeaders(resume: ResumeInfo | null): Record<string, string> {
  if (resume === null || resume.bytesDownloaded === 0) return {};

  const headers: Record<string, string> = { Range: `bytes=${resume.bytesDownloaded}-` };
  if (resume.etag !== null) headers['If-Range'] = resume.etag;
  else if (resume.lastModified !== null) headers['If-Range'] = resume.lastModified;
  return headers;
}

/**
 * Abre la conexión de descarga de `url`, reanudando desde `resume` si se
 * pasa uno.
 *
 * @param url - De dónde descargar.
 * @param resume - Progreso previo conocido, o `null` para empezar de cero.
 * @returns El stream a consumir, o `AppError` `net.unreachable` si la
 *   petición falla, o el código HTTP no es 200/206.
 */
export async function openDownloadStream(url: string, resume: ResumeInfo | null): Promise<Result<DownloadStream, AppError>> {
  let response: Response;
  try {
    response = await fetch(url, { headers: buildHeaders(resume) });
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'net.unreachable', retriable: true });
  }

  if (!response.ok) {
    return err(
      appError('net.unreachable', { retriable: response.status >= 500, context: { url, status: response.status } }),
    );
  }
  if (response.body === null) {
    return err(appError('unknown', { detail: 'la respuesta no tiene cuerpo' }));
  }

  const contentLength = response.headers.get('content-length');
  const wasPartial = response.status === 206;
  const requestedRange = resume !== null && resume.bytesDownloaded > 0;
  const alreadyDownloaded = wasPartial && resume !== null ? resume.bytesDownloaded : 0;

  return ok({
    body: response.body,
    mustRestartFromZero: requestedRange && !wasPartial,
    bytesTotal: contentLength === null ? null : Number.parseInt(contentLength, 10) + alreadyDownloaded,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  });
}
