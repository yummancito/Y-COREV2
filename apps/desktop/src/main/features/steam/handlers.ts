/**
 * Handlers IPC de `steam.*` — el puente entre el router y `SteamService`.
 */

import type { Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import type { ChannelOutput, contract } from '@ycore/ipc-contract';
import type { SteamService } from './service.js';

type ImportLibraryOutput = ChannelOutput<typeof contract['steam.importLibrary']>;

/** Construye los handlers de `steam.*` cerrados sobre un `SteamService` concreto. */
export function createSteamHandlers(service: SteamService) {
  return {
    importLibrary: (): Promise<Result<ImportLibraryOutput, AppError>> => service.importLibrary(),
  };
}
