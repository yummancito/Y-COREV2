/**
 * `DownloadState` — la máquina de estados de una descarga, y `transition` para moverse entre ellos.
 *
 * Sirve para que un estado inválido sea inexpresable (ADR-0004): cada variante
 * de la unión discriminada solo lleva los campos que ese estado tiene sentido
 * que lleve (`downloading` tiene `bytesDownloaded`, `failed` tiene `error`,
 * `done` no tiene ninguno de los dos), y la única forma de cambiar de estado
 * es `transition()`, que rechaza cualquier par que no esté en
 * `ALLOWED_TRANSITIONS`. Esto reemplaza al `download-engine-repair.ts` del v1,
 * que existía para arreglar estados imposibles que nadie impedía crear.
 *
 * Puro: sin I/O, sin Electron, sin `node:fs` — solo depende de `@ycore/result`
 * (regla de `core-domain`, roadmap sección A.3).
 */

import { err, ok, type Result } from '@ycore/result';
import { appError, type AppError } from '@ycore/result/app-error';

/** Los ocho estados posibles de una descarga. */
export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'extracting'
  | 'installing'
  | 'done'
  | 'failed';

interface DownloadStateBase {
  readonly id: string;
}

/** En cola, todavía sin bytes descargados. */
export interface QueuedState extends DownloadStateBase {
  readonly status: 'queued';
}

/** Descargando activamente. `bytesDownloaded` es el offset real para el `Range` al reanudar. */
export interface DownloadingState extends DownloadStateBase {
  readonly status: 'downloading';
  readonly bytesDownloaded: number;
  readonly bytesTotal: number | null;
}

/** Pausado por el usuario o por un fallo recuperable a mitad de descarga. Persistido, no un flag. */
export interface PausedState extends DownloadStateBase {
  readonly status: 'paused';
  readonly bytesDownloaded: number;
  readonly bytesTotal: number | null;
}

/** Verificando el hash del archivo completo contra `expectedSha256`. */
export interface VerifyingState extends DownloadStateBase {
  readonly status: 'verifying';
}

/** Extrayendo el archivo verificado a `installPath`. */
export interface ExtractingState extends DownloadStateBase {
  readonly status: 'extracting';
}

/** Moviendo/finalizando la instalación tras extraer. */
export interface InstallingState extends DownloadStateBase {
  readonly status: 'installing';
}

/** Terminal: instalado correctamente. */
export interface DoneState extends DownloadStateBase {
  readonly status: 'done';
}

/** Terminal (hasta que el usuario reintente): guarda el error que la produjo. */
export interface FailedState extends DownloadStateBase {
  readonly status: 'failed';
  readonly error: AppError;
}

/** Unión discriminada por `status`. Cada variante lleva solo los datos que tienen sentido en ella. */
export type DownloadState =
  | QueuedState
  | DownloadingState
  | PausedState
  | VerifyingState
  | ExtractingState
  | InstallingState
  | DoneState
  | FailedState;

/**
 * Tabla de transiciones legales. `failed -> queued` es el único camino de
 * salida de un fallo, y es siempre un reintento explícito del usuario, nunca
 * automático. `done` y (implícitamente) `failed` sin reintento son terminales.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<DownloadStatus, ReadonlySet<DownloadStatus>>> = {
  queued: new Set<DownloadStatus>(['downloading', 'failed']),
  downloading: new Set<DownloadStatus>(['verifying', 'paused', 'failed']),
  paused: new Set<DownloadStatus>(['downloading', 'failed']),
  verifying: new Set<DownloadStatus>(['extracting', 'failed']),
  extracting: new Set<DownloadStatus>(['installing', 'failed']),
  installing: new Set<DownloadStatus>(['done', 'failed']),
  done: new Set<DownloadStatus>(),
  failed: new Set<DownloadStatus>(['queued']),
};

/**
 * Intenta mover un `DownloadState` a un nuevo estado.
 *
 * Sirve para que ningún estado inválido pueda escribirse: no existe otro
 * camino para cambiar `status` que pasar por aquí, y aquí se rechaza
 * cualquier par que no esté en {@link ALLOWED_TRANSITIONS}.
 *
 * @param current - Estado actual de la descarga.
 * @param next - El estado propuesto (ya con los datos que le correspondan).
 * @returns `next` si la transición `current.status -> next.status` es legal,
 *   o `AppError` `download.invalid-transition` si no lo es.
 */
export function transition(current: DownloadState, next: DownloadState): Result<DownloadState, AppError> {
  const allowed = ALLOWED_TRANSITIONS[current.status];
  if (!allowed.has(next.status)) {
    return err(
      appError('download.invalid-transition', {
        context: { id: current.id, from: current.status, to: next.status },
      }),
    );
  }
  return ok(next);
}
