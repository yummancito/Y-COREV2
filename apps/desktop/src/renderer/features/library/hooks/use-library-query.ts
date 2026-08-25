/**
 * `useLibraryQuery` — trae la biblioteca completa vía `window.ycore.library.list`.
 *
 * Sirve como la única forma en que el renderer lee datos de biblioteca: nunca
 * se guarda en zustand (regla de la sección A.3 del roadmap — "la duplicación
 * V1/V2 nació de meter datos del backend en zustand"). El `Result` del bridge
 * IPC se traduce aquí a las convenciones de TanStack Query: éxito → `data`,
 * `AppError` → `error` lanzado, para que `isPending`/`isError`/`data` de
 * TanStack Query sean la única API que el resto del renderer necesita conocer.
 */

import { useQuery } from '@tanstack/react-query';
import { isErr } from '@ycore/result';

/**
 * Clave de query de la biblioteca completa. No se exporta: hoy no hay ningún
 * consumidor externo que necesite invalidarla (lanzar un juego no cambia sus
 * datos todavía). Si en el futuro algo necesita invalidar la biblioteca desde
 * fuera de este archivo, se vuelve a exportar entonces.
 */
const libraryQueryKey = ['library', 'list'] as const;

async function fetchLibrary() {
  const result = await window.ycore.library.list({});
  if (isErr(result)) throw new Error(result.error.code);
  return result.value.games;
}

/** Hook de TanStack Query sobre la biblioteca completa. */
export function useLibraryQuery() {
  return useQuery({ queryKey: libraryQueryKey, queryFn: fetchLibrary });
}
