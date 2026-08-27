/**
 * `spawnSilentInstaller` — lanza el instalador NSIS de una actualización ya
 * verificada, en modo silencioso.
 *
 * Sirve como el único lugar que habla con el instalador de la propia app
 * (roadmap, sección A.3: "platform/ — único sitio que habla con el SO"),
 * separado de `process-launcher.ts` (lanza juegos) porque el instalador NSIS
 * necesita sus propios flags (`/S` = silencioso, sin diálogos) y, a
 * diferencia de un juego, **no** se lanza `detached` de la vida de Y-CORE:
 * el llamador (`updates/install.ts`) cierra la app inmediatamente después,
 * así que el instalador debe seguir vivo aunque el proceso padre termine —
 * de ahí `detached: true` + `unref()`, igual que un juego, pero por una
 * razón distinta (aquí el padre se cierra a propósito, no porque el usuario
 * cierre Y-CORE mientras el juego sigue jugándose).
 */

import { spawn } from 'node:child_process';
import { err, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';
import { createLogger } from '@ycore/logger';

const log = createLogger('main:platform:installer-launcher');

/** Flag de electron-builder/NSIS para instalación silenciosa, sin diálogos ni progreso visible. */
const SILENT_INSTALL_FLAG = '/S';

/**
 * Lanza el instalador ya descargado y verificado, en modo silencioso.
 *
 * @param installerPath - Ruta absoluta del `Setup.exe` ya verificado (Ed25519 + SHA-512).
 * @returns `ok(undefined)` si el sistema operativo pudo crear el proceso, o
 *   `AppError` `io.failed` si no (nunca lanza). El llamador debe cerrar
 *   Y-CORE inmediatamente después de un `ok`.
 */
export function spawnSilentInstaller(installerPath: string): Result<void, AppError> {
  try {
    const child = spawn(installerPath, [SILENT_INSTALL_FLAG], { detached: true, stdio: 'ignore' });

    child.on('error', (error) => {
      log.warn('el instalador falló después de crearse (fallo asíncrono del SO)', {
        installerPath,
        detail: String(error),
      });
    });
    child.unref();

    if (child.pid === undefined) {
      return err(appError('io.failed', { context: { installerPath } }));
    }
    return ok(undefined);
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
}
