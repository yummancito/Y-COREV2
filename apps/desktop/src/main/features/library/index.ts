/**
 * `main/features/library` — API pública explícita de la feature Biblioteca.
 *
 * Sirve para que `main/ipc/registry.ts` construya sus handlers sin conocer
 * la estructura interna de la feature (repository.ts, service.ts). Explícito
 * a propósito: el v1 tenía un barrel que reexportaba 14 de 31 servicios sin
 * que nadie supiera cuáles eran realmente públicos.
 */

export { LibraryRepository } from './repository.js';
export { LibraryService } from './service.js';
export { createLibraryHandlers } from './handlers.js';
