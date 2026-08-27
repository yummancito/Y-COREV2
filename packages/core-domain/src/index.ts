/**
 * `core-domain` — tipos y reglas de negocio puras de Y-CORE.
 *
 * Sirve como el único lugar del repo con lógica testeable sin Electron ni
 * `node:fs` (roadmap, sección A.3). Feature-agnóstico a propósito: si algo
 * aquí necesita saber de una feature concreta, es que no pertenece a
 * `core-domain` sino a `main/features/<x>`.
 */

export {
  createUninstalledGame,
  isInstalled,
  type AppId,
  type Game,
  type Installation,
} from './game.js';

export { resolveLaunchCommand, type LaunchCommand, type LaunchOptions } from './launch.js';

export {
  transition,
  ALLOWED_TRANSITIONS,
  type DownloadState,
  type DownloadStatus,
  type QueuedState,
  type DownloadingState,
  type PausedState,
  type VerifyingState,
  type ExtractingState,
  type InstallingState,
  type DoneState,
  type FailedState,
} from './download-state.js';

export { ProgressThrottle, type ProgressSample } from './progress-throttle.js';

export { TokenBucket } from './token-bucket.js';

export {
  migrateSettings,
  DEFAULT_APP_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  type AppSettings,
  type UpdateChannel,
} from './app-settings.js';
