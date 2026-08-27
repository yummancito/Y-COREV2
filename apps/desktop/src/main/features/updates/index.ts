/**
 * `main/features/updates` — API pública explícita de la feature Actualizaciones.
 *
 * Sirve para que `main/ipc/registry.ts` y `main/bootstrap/` construyan sus
 * handlers y el ciclo periódico sin conocer la estructura interna de la feature.
 */

export { ClientIdRepository } from './client-id-repository.js';
export { UpdateService, type UpdateServiceConfig } from './service.js';
export { createUpdateHandlers } from './handlers.js';
