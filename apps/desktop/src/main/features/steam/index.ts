/**
 * `main/features/steam` — API pública explícita de la feature Steam.
 *
 * Sirve para que `main/ipc/registry.ts` construya sus handlers sin conocer
 * la estructura interna de la feature.
 */

export { SteamService } from './service.js';
export { createSteamHandlers } from './handlers.js';
