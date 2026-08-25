/**
 * `DownloadRepository` — acceso a disco de la feature Descargas.
 *
 * Sirve como el único lugar que traduce entre la tabla `downloads` (Drizzle,
 * columnas planas) y `DownloadRecord` (estado de `@ycore/core-domain` +
 * metadatos). El servicio de la feature (`service.ts`) nunca ve columnas de
 * Drizzle, solo `DownloadRecord`. Es también quien traduce el rechazo del
 * índice único parcial `downloads_active_app` (ADR-0004, punto 4) a
 * `AppError` `download.duplicate` — SQLite es la fuente de verdad de que no
 * hay dos descargas activas del mismo `appId`, no un `if` en memoria.
 */

import { and, eq, notInArray } from 'drizzle-orm';
import { err, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';
import type { DownloadState, DownloadStatus } from '@ycore/core-domain';
import { downloads, type YCoreDatabase } from '../../db/index.js';
import type { DownloadMetadata, DownloadRecord } from './download-record.js';

/** Fila cruda de la tabla `downloads`, tal como la devuelve Drizzle. */
type DownloadRow = typeof downloads.$inferSelect;

const TERMINAL_STATUSES: DownloadStatus[] = ['done', 'failed'];

/** Convierte una fila de `downloads` al `DownloadState` de dominio para su `status`. */
function rowToState(row: DownloadRow): DownloadState {
  switch (row.status as DownloadStatus) {
    case 'queued':
      return { id: row.id, status: 'queued' };
    case 'downloading':
      return { id: row.id, status: 'downloading', bytesDownloaded: row.bytesDownloaded, bytesTotal: row.bytesTotal };
    case 'paused':
      return { id: row.id, status: 'paused', bytesDownloaded: row.bytesDownloaded, bytesTotal: row.bytesTotal };
    case 'verifying':
      return { id: row.id, status: 'verifying' };
    case 'extracting':
      return { id: row.id, status: 'extracting' };
    case 'installing':
      return { id: row.id, status: 'installing' };
    case 'done':
      return { id: row.id, status: 'done' };
    case 'failed':
      return {
        id: row.id,
        status: 'failed',
        error:
          row.errorCode === null
            ? appError('unknown', { detail: 'error_code ausente en la fila' })
            : appError(row.errorCode as AppError['code']),
      };
  }
}

function rowToMetadata(row: DownloadRow): DownloadMetadata {
  return {
    appId: row.appId,
    sourceUrl: row.sourceUrl,
    destinationPath: row.destinationPath,
    installPath: row.installPath,
    expectedSha256: row.expectedSha256,
    etag: row.etag,
    lastModified: row.lastModified,
    segmentIndex: row.segmentIndex,
    segmentCount: row.segmentCount,
    retryCount: row.retryCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToRecord(row: DownloadRow): DownloadRecord {
  return { state: rowToState(row), metadata: rowToMetadata(row) };
}

/** Extrae de un `DownloadState` las columnas que dependen del estado (status, bytes, error). */
function stateToColumns(state: DownloadState): Partial<typeof downloads.$inferInsert> {
  switch (state.status) {
    case 'downloading':
    case 'paused':
      return { status: state.status, bytesDownloaded: state.bytesDownloaded, bytesTotal: state.bytesTotal };
    case 'failed':
      return { status: state.status, errorCode: state.error.code };
    default:
      return { status: state.status };
  }
}

export class DownloadRepository {
  constructor(private readonly db: YCoreDatabase) {}

  /** Todas las descargas conocidas, en cualquier estado. */
  findAll(): DownloadRecord[] {
    return this.db.select().from(downloads).all().map(rowToRecord);
  }

  /** Busca una descarga por su id. @returns `Err('not-found')` si no existe. */
  findById(id: string): Result<DownloadRecord, AppError> {
    const row = this.db.select().from(downloads).where(eq(downloads.id, id)).get();
    if (row === undefined) return err(appError('not-found', { context: { id } }));
    return ok(rowToRecord(row));
  }

  /** La descarga activa (no terminal) de un `appId`, si existe alguna. */
  findActiveByAppId(appId: number): DownloadRecord | null {
    const row = this.db
      .select()
      .from(downloads)
      .where(and(eq(downloads.appId, appId), notInArray(downloads.status, TERMINAL_STATUSES)))
      .get();
    return row === undefined ? null : rowToRecord(row);
  }

  /**
   * Inserta una descarga nueva, siempre en estado `queued`.
   *
   * @returns `Err('download.duplicate')` si ya hay una descarga activa para
   *   el mismo `appId` — el índice único parcial `downloads_active_app` es
   *   quien lo garantiza; este método solo traduce el rechazo de SQLite.
   */
  insert(id: string, metadata: DownloadMetadata): Result<DownloadRecord, AppError> {
    try {
      this.db
        .insert(downloads)
        .values({
          id,
          appId: metadata.appId,
          status: 'queued',
          sourceUrl: metadata.sourceUrl,
          destinationPath: metadata.destinationPath,
          installPath: metadata.installPath,
          expectedSha256: metadata.expectedSha256,
          etag: metadata.etag,
          lastModified: metadata.lastModified,
          segmentIndex: metadata.segmentIndex,
          segmentCount: metadata.segmentCount,
          retryCount: metadata.retryCount,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
        })
        .run();
    } catch (error) {
      const isUniqueViolation =
        error instanceof Error &&
        'code' in error &&
        error.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
        error.message.includes('downloads');
      return err(isUniqueViolation ? appError('download.duplicate', { context: { appId: metadata.appId } }) : fromUnknown(error));
    }

    return this.findById(id);
  }

  /**
   * Persiste un nuevo `DownloadState` para una descarga ya existente.
   * No valida la transición — eso es responsabilidad de `transition()` en
   * `@ycore/core-domain`; este método solo escribe el resultado ya validado.
   */
  save(state: DownloadState, updatedAt: string): void {
    this.db
      .update(downloads)
      .set({ ...stateToColumns(state), updatedAt })
      .where(eq(downloads.id, state.id))
      .run();
  }

  /** Borra la fila (y su archivo parcial es responsabilidad del servicio, no del repositorio). */
  remove(id: string): void {
    this.db.delete(downloads).where(eq(downloads.id, id)).run();
  }
}
