/**
 * `renderer/features/downloads` — API pública explícita.
 *
 * Sirve para que `App.tsx` monte la pantalla sin conocer la estructura
 * interna de la feature. Explícito a propósito (misma regla que
 * `main/features/downloads/index.ts` y `renderer/features/library/index.ts`).
 */

export { DownloadsList } from './components/DownloadsList.js';
