/**
 * Handlers IPC de `downloads.*` — el puente entre el router y `DownloadService`.
 *
 * Sirve para traducir entre `DownloadRecord`/`DownloadState` (dominio) y la
 * forma exacta que exige el contrato Zod de `packages/ipc-contract` — el
 * servicio nunca conoce la forma del contrato, y el contrato nunca conoce
 * `DownloadService`.
 */

import { map, ok, type Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import type { ChannelInput, ChannelOutput, contract } from '@ycore/ipc-contract';
import type { DownloadRecord } from './download-record.js';
import type { DownloadService, EnqueueInput } from './service.js';

type ListOutput = ChannelOutput<(typeof contract)['downloads.list']>;
type EnqueueOutput = ChannelOutput<(typeof contract)['downloads.enqueue']>;
type EnqueueInputPayload = ChannelInput<(typeof contract)['downloads.enqueue']>;
type PauseInput = ChannelInput<(typeof contract)['downloads.pause']>;
type CancelInput = ChannelInput<(typeof contract)['downloads.cancel']>;

/** Convierte un `DownloadRecord` de dominio a la forma exacta que exige el contrato. */
function recordToPayload(record: DownloadRecord): ListOutput['downloads'][number] {
  return { state: record.state, appId: record.metadata.appId };
}

function toEnqueueInput(payload: EnqueueInputPayload): EnqueueInput {
  return {
    appId: payload.appId,
    sourceUrl: payload.sourceUrl,
    installPath: payload.installPath,
    expectedSha256: payload.expectedSha256,
  };
}

/** Construye los handlers de `downloads.*` cerrados sobre un `DownloadService` concreto. */
export function createDownloadHandlers(service: DownloadService) {
  return {
    list: (): Promise<Result<ListOutput, AppError>> =>
      Promise.resolve(ok({ downloads: service.list().map(recordToPayload) })),

    enqueue: (input: EnqueueInputPayload): Promise<Result<EnqueueOutput, AppError>> =>
      Promise.resolve(service.enqueue(toEnqueueInput(input))),

    pause: (input: PauseInput): Promise<Result<Record<string, never>, AppError>> =>
      Promise.resolve(map(service.pause(input.id), () => ({}))),

    cancel: (input: CancelInput): Promise<Result<Record<string, never>, AppError>> =>
      service.cancel(input.id).then((result) => map(result, () => ({}))),
  };
}
