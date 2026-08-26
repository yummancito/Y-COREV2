/**
 * `useDownloadsQuery` — trae la cola de descargas vía `window.ycore.downloads.list`.
 *
 * Sirve como la única forma en que el renderer lee el estado de las
 * descargas: nunca se guarda en zustand (misma regla que `useLibraryQuery`).
 * Como este repo no tiene todavía eventos push main→renderer (ver
 * `docs/02-features/downloads/decisions.md`), el progreso se lee por
 * **polling**: mientras haya al menos una descarga no terminal (`queued`,
 * `downloading`, `verifying`, `extracting`, `installing`), refresca cada
 * 500 ms; si todas están en `done`/`failed`/no hay ninguna, deja de sondear.
 */

import { useQuery } from '@tanstack/react-query';
import { isErr } from '@ycore/result';

const TERMINAL_STATUSES = new Set(['done', 'failed']);
const POLL_INTERVAL_MS = 500;

/** Clave de query de la cola de descargas. Se exporta para que las mutaciones la invaliden. */
export const downloadsQueryKey = ['downloads', 'list'] as const;

async function fetchDownloads() {
  const result = await window.ycore.downloads.list({});
  if (isErr(result)) throw new Error(result.error.code);
  return result.value.downloads;
}

/** Hook de TanStack Query sobre la cola de descargas, con polling mientras haya actividad. */
export function useDownloadsQuery() {
  return useQuery({
    queryKey: downloadsQueryKey,
    queryFn: fetchDownloads,
    refetchInterval: (query) => {
      const downloads = query.state.data;
      if (downloads === undefined) return POLL_INTERVAL_MS;
      const hasActive = downloads.some((d) => !TERMINAL_STATUSES.has(d.state.status));
      return hasActive ? POLL_INTERVAL_MS : false;
    },
  });
}
