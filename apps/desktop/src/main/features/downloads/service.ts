/**
 * `DownloadService` — orquesta el ciclo de vida completo de una descarga (ADR-0004).
 *
 * Sirve como el único lugar que junta la máquina de estados pura
 * (`transition()`, `@ycore/core-domain`) con el I/O real: `http-client.ts`
 * (Range/reanudación), `verifier.ts` (SHA-256), `extractor.ts` (ZIP), y
 * `DownloadRepository` (persistencia). Cada transición de estado pasa por
 * `transition()` antes de escribirse — un bug aquí produce un
 * `AppError` `download.invalid-transition`, nunca un estado corrupto en la
 * DB. El `Map<id, AbortController>` es la mitad en memoria de la
 * deduplicación (ADR-0004, punto 4): protege contra dos llamadas IPC casi
 * simultáneas abriendo dos streams sobre la misma fila, algo que el índice
 * único de la DB no puede ver.
 */

import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { err, ok, type Result } from '@ycore/result';
import { fromUnknown, type AppError } from '@ycore/result/app-error';
import { transition, TokenBucket, type DownloadState } from '@ycore/core-domain';
import type { DownloadMetadata, DownloadRecord } from './download-record.js';
import { DownloadRepository } from './repository.js';
import { openDownloadStream, type DownloadStream } from './http-client.js';
import { verifyFileSha256 } from './verifier.js';
import { extractZip } from './extractor.js';

/** Input para encolar una descarga nueva. */
export interface EnqueueInput {
  readonly appId: number;
  readonly sourceUrl: string;
  readonly installPath: string;
  readonly expectedSha256: string;
}

/**
 * `Transform` que aplica un {@link TokenBucket} al flujo de bytes: cada
 * chunk pide su cupo antes de pasar, esperando (`setTimeout` real, no
 * esparcido por el pipe — ver ADR-0004, punto 1) si el cupo está agotado.
 */
async function writeChunkThrottled(transform: Transform, bucket: TokenBucket, chunk: Buffer): Promise<void> {
  let offset = 0;
  while (offset < chunk.length) {
    const granted = bucket.take(chunk.length - offset, Date.now());
    if (granted === 0) {
      await delay(bucket.msUntilNextToken(Date.now()));
      continue;
    }
    transform.push(chunk.subarray(offset, offset + granted));
    offset += granted;
  }
}

/**
 * Exportada solo para test (`service-bandwidth.test.ts`): testear el
 * throttling contra un `Transform` puro, con un `TokenBucket` de reloj
 * inyectado, es determinista y rápido — verificar lo mismo a través de
 * `DownloadService` completo requeriría medir tiempo de reloj real bajo
 * carga variable de la suite (ver aprendizaje.md).
 */
export function createThrottledPassThrough(bucket: TokenBucket): Transform {
  const transform = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      writeChunkThrottled(transform, bucket, chunk).then(
        () => callback(),
        (error: Error) => callback(error),
      );
    },
  });
  return transform;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class DownloadService {
  private readonly inFlight = new Map<string, AbortController>();

  /**
   * @param repository - Acceso a la tabla `downloads`.
   * @param maxBytesPerSecond - Límite de ancho de banda global para todas las
   *   descargas de este servicio (ADR-0004, punto 1). `undefined` = sin límite.
   */
  constructor(
    private readonly repository: DownloadRepository,
    private readonly maxBytesPerSecond?: number,
  ) {}

  /** Todas las descargas conocidas, para que el renderer las liste (polling). */
  list(): DownloadRecord[] {
    return this.repository.findAll();
  }

  /**
   * Retoma toda descarga que quedó en `downloading` cuando el proceso murió
   * a mitad (`kill -9`, crash, cierre forzado) — nadie llamó a `pause()`, así
   * que la fila sigue como si estuviera activa. Se llama una vez en el
   * bootstrap, tras abrir la DB. El offset real para el `Range` es
   * `bytesDownloaded` tal como quedó persistido (con el margen de hasta un
   * segundo de descarga repetida que ya documenta el ADR-0004, punto 3).
   */
  resumeInterrupted(): void {
    for (const record of this.repository.findAll()) {
      if (record.state.status === 'downloading') void this.run(record.state.id);
    }
  }

  /**
   * Encola una descarga nueva y arranca su ejecución en segundo plano
   * (no espera a que termine: el IPC responde en cuanto queda en `queued`).
   *
   * @returns El id de la descarga, o `AppError` `download.duplicate` si ya
   *   hay una descarga activa para el mismo `appId`.
   */
  enqueue(input: EnqueueInput): Result<{ id: string }, AppError> {
    const id = randomUUID();
    const metadata: DownloadMetadata = {
      appId: input.appId,
      sourceUrl: input.sourceUrl,
      destinationPath: `${input.installPath}.download`,
      installPath: input.installPath,
      expectedSha256: input.expectedSha256,
      etag: null,
      lastModified: null,
      segmentIndex: 0,
      segmentCount: 1,
      retryCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const inserted = this.repository.insert(id, metadata);
    if (inserted.ok === false) return inserted;

    void this.run(id);
    return ok({ id });
  }

  /** Pausa una descarga en curso, abortando su conexión. Sin efecto si no está `downloading`. */
  pause(id: string): Result<void, AppError> {
    const found = this.repository.findById(id);
    if (found.ok === false) return found;
    if (found.value.state.status !== 'downloading') return ok(undefined);

    this.inFlight.get(id)?.abort();
    return this.moveTo(found.value.state, {
      id,
      status: 'paused',
      bytesDownloaded: found.value.state.bytesDownloaded,
      bytesTotal: found.value.state.bytesTotal,
    });
  }

  /** Cancela una descarga: aborta la conexión si sigue activa y borra fila + archivo parcial. */
  async cancel(id: string): Promise<Result<void, AppError>> {
    const found = this.repository.findById(id);
    if (found.ok === false) return found;

    this.inFlight.get(id)?.abort();
    this.inFlight.delete(id);
    this.repository.remove(id);
    await rm(found.value.metadata.destinationPath, { force: true });
    return ok(undefined);
  }

  /** Aplica `transition()` y persiste el resultado. Nunca escribe un estado sin validar. */
  private moveTo(current: DownloadState, next: DownloadState): Result<void, AppError> {
    const transitioned = transition(current, next);
    if (transitioned.ok === false) return transitioned;
    this.repository.save(transitioned.value, nowIso());
    return ok(undefined);
  }

  private async run(id: string): Promise<void> {
    const found = this.repository.findById(id);
    if (found.ok === false) return;

    const downloaded = await this.download(found.value);
    if (downloaded.ok === false) return;

    const verified = await this.verify(id, found.value.metadata);
    if (verified.ok === false) return;

    await this.extractAndInstall(id, found.value.metadata);
  }

  private async download(record: DownloadRecord): Promise<Result<void, AppError>> {
    const { state, metadata } = record;
    const controller = new AbortController();
    this.inFlight.set(state.id, controller);

    // `downloading` llega aquí también cuando resumeInterrupted() retoma una
    // fila que quedó a mitad por un kill -9: no hubo pause() explícito, pero
    // bytesDownloaded ya persistido es la verdad de dónde reanudar.
    const resumeBytes = state.status === 'paused' || state.status === 'downloading' ? state.bytesDownloaded : 0;
    const opened = await openDownloadStream(metadata.sourceUrl, {
      bytesDownloaded: resumeBytes,
      etag: metadata.etag,
      lastModified: metadata.lastModified,
    });
    if (opened.ok === false) {
      this.inFlight.delete(state.id);
      return this.failFrom(state, opened.error);
    }

    const downloading: DownloadState = {
      id: state.id,
      status: 'downloading',
      bytesDownloaded: opened.value.mustRestartFromZero ? 0 : resumeBytes,
      bytesTotal: opened.value.bytesTotal,
    };
    // Si ya estábamos en `downloading` (resumeInterrupted() tras un kill -9),
    // no hay transición que hacer — seguimos en el mismo estado, solo con el
    // stream abierto de nuevo. `downloading -> downloading` no está en
    // ALLOWED_TRANSITIONS a propósito (sería un no-op disfrazado de cambio).
    if (state.status !== 'downloading') {
      const moved = this.moveTo(state, downloading);
      if (moved.ok === false) return moved;
    } else {
      this.repository.save(downloading, nowIso());
    }

    return this.writeToDisk(downloading, metadata, opened.value, controller.signal);
  }

  private async writeToDisk(
    state: DownloadState,
    metadata: DownloadMetadata,
    opened: DownloadStream,
    signal: AbortSignal,
  ): Promise<Result<void, AppError>> {
    const flags = opened.mustRestartFromZero ? 'w' : 'a';
    try {
      // `Readable.fromWeb` espera el `ReadableStream` del lib DOM; `fetch`
      // (undici, sin lib DOM en este tsconfig) expone el de @types/node. Son
      // el mismo objeto en runtime — Node no distingue dos implementaciones,
      // solo TypeScript los tipa distinto al faltar la lib DOM.
      const webStream = opened.body as unknown as Parameters<typeof Readable.fromWeb>[0];
      const bucket = new TokenBucket(this.maxBytesPerSecond, Date.now());
      await pipeline(
        Readable.fromWeb(webStream),
        createThrottledPassThrough(bucket),
        createWriteStream(metadata.destinationPath, { flags }),
        { signal },
      );
    } catch (error) {
      if (signal.aborted) return ok(undefined);
      return this.failFrom(state, { ...fromUnknown(error), code: 'io.failed' });
    } finally {
      this.inFlight.delete(state.id);
    }

    return this.moveTo(state, { id: state.id, status: 'verifying' });
  }

  private async verify(id: string, metadata: DownloadMetadata): Promise<Result<void, AppError>> {
    const found = this.repository.findById(id);
    if (found.ok === false) return found;
    if (found.value.state.status !== 'verifying') return ok(undefined);

    const verified = await verifyFileSha256(metadata.destinationPath, metadata.expectedSha256);
    if (verified.ok === false) {
      await rm(metadata.destinationPath, { force: true });
      return this.failFrom(found.value.state, verified.error);
    }
    return this.moveTo(found.value.state, { id, status: 'extracting' });
  }

  private async extractAndInstall(id: string, metadata: DownloadMetadata): Promise<void> {
    const found = this.repository.findById(id);
    if (found.ok === false || found.value.state.status !== 'extracting') return;

    const extracted = await extractZip(metadata.destinationPath, metadata.installPath);
    if (extracted.ok === false) {
      this.failFrom(found.value.state, extracted.error);
      return;
    }

    const installing = this.moveTo(found.value.state, { id, status: 'installing' });
    if (installing.ok === false) return;

    await rm(metadata.destinationPath, { force: true });
    const installed = this.repository.findById(id);
    if (installed.ok === true) this.moveTo(installed.value.state, { id, status: 'done' });
  }

  private failFrom(state: DownloadState, error: AppError): Result<never, AppError> {
    this.moveTo(state, { id: state.id, status: 'failed', error });
    return err(error);
  }
}
