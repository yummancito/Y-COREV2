/**
 * `resolveLaunchCommand` — decide qué ejecutable y argumentos lanzar para un juego.
 *
 * Sirve para separar la **decisión** de lanzamiento (pura, testeable) de su
 * **ejecución** (spawn de un proceso, que vive en `main/platform` porque toca
 * el SO). Aquí no se abre ningún proceso; solo se calcula qué comando
 * correspondería, y por qué no se puede si el juego no está instalado.
 */

import { err, ok, type Result } from '@ycore/result';
import { appError, type AppError } from '@ycore/result/app-error';
import { isInstalled, type Game } from './game.js';

/** Comando resuelto, listo para que `main/platform` lo ejecute con `spawn`. */
export interface LaunchCommand {
  readonly executablePath: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

/** Argumentos de lanzamiento declarados por el usuario para un juego (opcional). */
export interface LaunchOptions {
  readonly extraArgs?: readonly string[];
}

/**
 * Resuelve el comando de lanzamiento de un juego.
 *
 * @param game - El juego a lanzar. Su `installation` determina si es posible.
 * @param options - Argumentos extra que el usuario configuró para este juego.
 * @returns El `LaunchCommand` a ejecutar, o un `AppError`: `not-found` si el
 *   juego no está instalado (estado esperable, no un bug — el usuario pudo
 *   desinstalarlo fuera de Y-CORE), o `unknown` si está instalado pero
 *   todavía no se resolvió su ejecutable (ver {@link Installation.executablePath}).
 */
export function resolveLaunchCommand(
  game: Game,
  options: LaunchOptions = {},
): Result<LaunchCommand, AppError> {
  if (!isInstalled(game)) {
    return err(appError('not-found', { context: { appId: game.appId } }));
  }

  const { executablePath, path } = game.installation;
  if (executablePath === null) {
    return err(
      appError('unknown', {
        context: { appId: game.appId },
        detail: 'installation.executablePath no está resuelto todavía',
      }),
    );
  }

  return ok({ executablePath, args: options.extraArgs ?? [], cwd: path });
}
