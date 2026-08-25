/**
 * `renderer/features/library` — API pública explícita.
 *
 * Sirve para que `App.tsx` monte la pantalla sin conocer la estructura
 * interna de la feature. Explícito a propósito (ver la misma regla en
 * `main/features/library/index.ts`).
 */

export { LibraryGrid } from './components/LibraryGrid.js';
