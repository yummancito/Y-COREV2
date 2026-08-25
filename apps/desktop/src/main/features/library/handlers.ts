/**
 * Handlers IPC de `library.*` — el puente entre el router y `LibraryService`.
 *
 * Sirve como la única capa que traduce entre el tipo de dominio (`Game` de
 * `@ycore/core-domain`) y la forma exacta que declara `packages/ipc-contract`
 * para `library.list`/`library.launch` — son casi iguales pero son tipos
 * distintos a propósito (ver el comentario en `channels/library.ts`).
 */

import { ok, type Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import type { ChannelInput, ChannelOutput, contract } from '@ycore/ipc-contract';
import type { Game } from '@ycore/core-domain';
import type { LibraryService } from './service.js';

type ListOutput = ChannelOutput<typeof contract['library.list']>;
type LaunchInput = ChannelInput<typeof contract['library.launch']>;
type LaunchOutput = ChannelOutput<typeof contract['library.launch']>;

/** Convierte un `Game` de dominio a la forma exacta del contrato IPC. */
function gameToChannelShape(game: Game): ListOutput['games'][number] {
  return {
    appId: game.appId,
    name: game.name,
    installation: game.installation,
  };
}

/**
 * Construye los handlers de `library.*` cerrados sobre un `LibraryService`
 * concreto. Propiedades con arrow function (no shorthand method syntax): se
 * asignan como referencias sueltas al registry (`registry['library.list'] =
 * library.listGames`), y un shorthand method pierde su `this` al
 * desconectarse así del objeto — un arrow function no tiene ese problema
 * porque no usa `this` en absoluto.
 */
export function createLibraryHandlers(service: LibraryService) {
  return {
    listGames: (): Promise<Result<ListOutput, AppError>> => {
      const games = service.listGames().map(gameToChannelShape);
      return Promise.resolve(ok({ games }));
    },

    launchGame: (input: LaunchInput): Promise<Result<LaunchOutput, AppError>> => {
      return Promise.resolve(service.launchGame(input.appId));
    },
  };
}
