/**
 * `useUpdateStatusQuery` — trae el estado del ciclo de actualización vía
 * `window.ycore.updates.getStatus`.
 *
 * Sirve como la única forma en que el renderer sabe si hay una actualización.
 * Igual que `useDownloadsQuery` (ver `docs/02-features/downloads/decisions.md`),
 * no hay eventos push main→renderer en este repo: se hace polling mientras
 * la fase no sea `up-to-date` (una vez al día es barato, así que fuera de
 * `downloading`/`available` el intervalo es largo).
 */

import { useQuery } from '@tanstack/react-query';
import { isErr } from '@ycore/result';

const POLL_INTERVAL_ACTIVE_MS = 1000;
const POLL_INTERVAL_IDLE_MS = 60_000;

const updateStatusQueryKey = ['updates', 'status'] as const;

async function fetchUpdateStatus() {
  const result = await window.ycore.updates.getStatus({});
  if (isErr(result)) throw new Error(result.error.code);
  return result.value.status;
}

/** Hook de TanStack Query sobre el estado de actualización, con polling adaptado a la fase. */
export function useUpdateStatusQuery() {
  return useQuery({
    queryKey: updateStatusQueryKey,
    queryFn: fetchUpdateStatus,
    refetchInterval: (query) => (query.state.data?.phase === 'up-to-date' ? POLL_INTERVAL_IDLE_MS : POLL_INTERVAL_ACTIVE_MS),
  });
}
