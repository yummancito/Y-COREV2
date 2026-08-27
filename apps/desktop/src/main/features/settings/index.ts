/**
 * `main/features/settings` — API pública explícita de la feature Ajustes.
 *
 * Sirve para que `main/ipc/registry.ts` construya sus handlers sin conocer la
 * estructura interna de la feature.
 */

export { SettingsRepository } from './repository.js';
export { SettingsService } from './service.js';
export { createSettingsHandlers } from './handlers.js';
