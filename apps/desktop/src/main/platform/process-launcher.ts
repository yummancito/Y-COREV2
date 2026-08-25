/**
 * `spawnDetached` — lanza un proceso independiente de Y-CORE (ej. un juego).
 *
 * Sirve como el único lugar del repo que llama `child_process.spawn` para
 * lanzar ejecutables externos (roadmap, sección A.3: "platform/ — único
 * sitio que habla con el SO"). Features nunca importan `node:child_process`
 * directamente — piden un `LaunchCommand` (ya resuelto por `core-domain`) y
 * este módulo lo ejecuta.
 *
 * `detached: true` porque el proceso lanzado (un juego) debe seguir vivo
 * aunque Y-CORE se cierre — nunca debe ser hijo del proceso de Y-CORE en el
 * sentido de que su vida dependa de la nuestra.
 */

import { spawn } from 'node:child_process';
import { err, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';
import { createLogger } from '@ycore/logger';
import type { LaunchCommand } from '@ycore/core-domain';

const log = createLogger('main:platform:process-launcher');

/**
 * Lanza el ejecutable de un `LaunchCommand` ya resuelto.
 *
 * En Windows, `spawn` con un ejecutable inexistente NO lanza de forma
 * síncrona: crea el `ChildProcess` con éxito (con `pid` asignado) y emite
 * `'error'` (ENOENT) de forma asíncrona un instante después. Por eso este
 * `Result` síncrono solo puede reportar los fallos que el SO da al crear el
 * proceso (ver `if (child.pid === undefined)`); el listener de `'error'`
 * existe para que ese ENOENT tardío no se propague como excepción no
 * controlada — solo queda registrado, porque para entonces ya devolvimos un
 * `Result` al llamador y no hay forma de "revocar" esa respuesta.
 *
 * @param command - Ejecutable, argumentos y directorio de trabajo a usar.
 * @returns El PID del proceso lanzado, o un `AppError` `io.failed` si el
 *   sistema operativo no pudo crear el proceso en absoluto (nunca lanza).
 */
export function spawnDetached(command: LaunchCommand): Result<{ pid: number }, AppError> {
  try {
    const child = spawn(command.executablePath, command.args, {
      cwd: command.cwd,
      detached: true,
      stdio: 'ignore',
    });

    child.on('error', (error) => {
      log.warn('el proceso lanzado falló después de crearse (fallo asíncrono del SO)', {
        executablePath: command.executablePath,
        detail: String(error),
      });
    });
    child.unref();

    if (child.pid === undefined) {
      return err(appError('io.failed', { context: { executablePath: command.executablePath } }));
    }
    return ok({ pid: child.pid });
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
}
