/**
 * `useCancelDownload` — cancela una descarga vía `window.ycore.downloads.cancel`.
 *
 * Sirve como la única forma en que el renderer cancela y borra una descarga.
 * Invalida la cola al completar, igual que `useEnqueueDownload`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isErr } from '@ycore/result';
import { downloadsQueryKey } from './use-downloads-query.js';

async function cancelDownload(id: string) {
  const result = await window.ycore.downloads.cancel({ id });
  if (isErr(result)) throw new Error(result.error.code);
  return result.value;
}

/** Hook de mutación de TanStack Query para cancelar y borrar una descarga por su id. */
export function useCancelDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelDownload,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: downloadsQueryKey }),
  });
}
