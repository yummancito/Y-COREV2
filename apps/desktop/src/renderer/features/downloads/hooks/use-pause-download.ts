/**
 * `usePauseDownload` — pausa una descarga en curso vía `window.ycore.downloads.pause`.
 *
 * Sirve como la única forma en que el renderer pausa una descarga. Invalida
 * la cola al completar, igual que `useEnqueueDownload`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isErr } from '@ycore/result';
import { downloadsQueryKey } from './use-downloads-query.js';

async function pauseDownload(id: string) {
  const result = await window.ycore.downloads.pause({ id });
  if (isErr(result)) throw new Error(result.error.code);
  return result.value;
}

/** Hook de mutación de TanStack Query para pausar una descarga por su id. */
export function usePauseDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pauseDownload,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: downloadsQueryKey }),
  });
}
