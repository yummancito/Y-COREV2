/**
 * `main/features/downloads` — API pública explícita de la feature Descargas.
 *
 * Sirve para que `main/ipc/registry.ts` construya sus handlers sin conocer
 * la estructura interna de la feature.
 */

export { DownloadRepository } from './repository.js';
export { DownloadService } from './service.js';
export { createDownloadHandlers } from './handlers.js';
