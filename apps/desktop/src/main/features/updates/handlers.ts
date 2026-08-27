/**
 * Handlers IPC de `updates.*` — el puente entre el router y `UpdateService`.
 *
 * Sirve para traducir `UpdateStatus` (dominio de la feature) a la forma
 * exacta que exige el contrato Zod de `packages/ipc-contract` — el servicio
 * nunca conoce la forma del contrato.
 */

import { ok, type Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import type { ChannelOutput, contract } from '@ycore/ipc-contract';
import type { UpdateService, UpdateStatus } from './service.js';

type GetStatusOutput = ChannelOutput<(typeof contract)['updates.getStatus']>;

function statusToPayload(status: UpdateStatus): GetStatusOutput['status'] {
  return status;
}

/** Construye los handlers de `updates.*` cerrados sobre un `UpdateService` concreto. */
export function createUpdateHandlers(service: UpdateService, onBeforeQuitToInstall: () => void) {
  return {
    getStatus: (): Promise<Result<GetStatusOutput, AppError>> =>
      Promise.resolve(ok({ status: statusToPayload(service.getStatus()) })),

    installNow: (): Promise<Result<Record<string, never>, AppError>> => {
      service.installNow(onBeforeQuitToInstall);
      return Promise.resolve(ok({}));
    },
  };
}
