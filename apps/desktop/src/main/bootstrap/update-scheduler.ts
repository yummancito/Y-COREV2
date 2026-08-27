/**
 * `createUpdateService` y `startUpdateScheduler` — conectan `main/features/updates`
 * con el entorno de Electron y con un ciclo periódico real.
 *
 * Sirve para leer la configuración de updates (URL del Worker, secreto
 * compartido, claves públicas Ed25519 embebidas) de variables de entorno de
 * build — nunca hardcodeadas en el código fuente — y arrancar
 * `checkNow()` cada `checkIntervalMs` desde el bootstrap. Separado de
 * `main/index.ts` por el mismo motivo que `steam-watcher.ts`: el punto de
 * entrada no debe crecer por cada feature con su propio ciclo de vida.
 */

import { app } from 'electron';
import { createLogger } from '@ycore/logger';
import type { YCoreDatabase } from '../db/index.js';
import { ClientIdRepository, UpdateService, type UpdateServiceConfig } from '../features/updates/index.js';

const log = createLogger('main:bootstrap:update-scheduler');

const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Lee `YCORE_WORKER_URL`, `YCORE_CLIENT_SECRET` y `YCORE_MANIFEST_PUBLIC_KEYS`
 * (coma-separadas) del entorno de build. Si falta alguna, la feature de
 * updates queda inerte (siempre `up-to-date`) en vez de romper el arranque
 * de la app — comprobar actualizaciones nunca puede ser un requisito para
 * que Y-CORE abra.
 */
function readUpdateServiceConfig(db: YCoreDatabase): UpdateServiceConfig | null {
  const workerBaseUrl = process.env.YCORE_WORKER_URL;
  const clientSecret = process.env.YCORE_CLIENT_SECRET;
  const publicKeysRaw = process.env.YCORE_MANIFEST_PUBLIC_KEYS;

  if (workerBaseUrl === undefined || clientSecret === undefined || publicKeysRaw === undefined) {
    log.warn('configuración de updates incompleta en el entorno, la comprobación queda desactivada');
    return null;
  }

  return {
    workerBaseUrl,
    clientSecret,
    manifestPublicKeysBase64: publicKeysRaw.split(',').filter((key) => key.length > 0),
    currentVersion: app.getVersion(),
    channel: 'stable',
    clientId: new ClientIdRepository(db).getOrCreate(),
  };
}

/** Un `UpdateService` inerte para cuando falta configuración — siempre reporta `up-to-date`. */
function createInertUpdateService(): UpdateService {
  return new UpdateService({
    workerBaseUrl: 'http://127.0.0.1:0',
    clientSecret: '',
    manifestPublicKeysBase64: [],
    currentVersion: app.getVersion(),
    channel: 'stable',
    clientId: '00000000-0000-4000-8000-000000000000',
  });
}

/**
 * Construye el `UpdateService` de esta sesión, a partir de la config del entorno.
 * @param db - Conexión de Drizzle ya migrada, para persistir el `clientId`.
 */
export function createUpdateService(db: YCoreDatabase): UpdateService {
  const config = readUpdateServiceConfig(db);
  return config === null ? createInertUpdateService() : new UpdateService(config);
}

/**
 * Arranca el ciclo periódico de `checkNow()`. La primera comprobación ocurre
 * en el arranque, no espera al primer intervalo completo.
 */
export function startUpdateScheduler(service: UpdateService, checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS): void {
  void service.checkNow();
  const timer = setInterval(() => void service.checkNow(), checkIntervalMs);
  timer.unref();
  app.on('will-quit', () => clearInterval(timer));
}
