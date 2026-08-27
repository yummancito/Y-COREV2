/**
 * Handlers IPC de `settings.*` — el puente entre el router y `SettingsService`.
 *
 * Sirve para traducir `AppSettings` (dominio) a la forma exacta del contrato
 * Zod — el servicio nunca conoce la forma del contrato.
 */

import { ok, type Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import type { ChannelInput, ChannelOutput, contract } from '@ycore/ipc-contract';
import type { SettingsService } from './service.js';

type GetOutput = ChannelOutput<(typeof contract)['settings.get']>;
type UpdateInput = ChannelInput<(typeof contract)['settings.update']>;
type UpdateOutput = ChannelOutput<(typeof contract)['settings.update']>;

/** Construye los handlers de `settings.*` cerrados sobre un `SettingsService` concreto. */
export function createSettingsHandlers(service: SettingsService) {
  return {
    get: (): Promise<Result<GetOutput, AppError>> => Promise.resolve(ok({ settings: service.read() })),

    update: (input: UpdateInput): Promise<Result<UpdateOutput, AppError>> =>
      Promise.resolve(ok({ settings: service.update(input.settings) })),
  };
}
