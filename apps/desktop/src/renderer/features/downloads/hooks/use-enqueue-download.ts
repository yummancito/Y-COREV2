/**
 * `useEnqueueDownload` — encola una descarga vía `window.ycore.downloads.enqueue`.
 *
 * Sirve como la única forma en que el renderer arranca una descarga nueva.
 * Al completar, invalida la query de la cola (`useDownloadsQuery`) para que
 * la nueva fila aparezca de inmediato, sin esperar al siguiente poll.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isErr } from '@ycore/result';
import { downloadsQueryKey } from './use-downloads-query.js';

/**
 * Lo que necesita el bridge para encolar una descarga nueva. No exportado:
 * hoy no hay ningún componente que arme este input desde fuera de este
 * archivo (no hay flujo de "elegir qué descargar" en la UI todavía). Si
 * surge un consumidor real, se vuelve a exportar entonces.
 */
interface EnqueueDownloadInput {
  readonly appId: number;
  readonly sourceUrl: string;
  readonly installPath: string;
  readonly expectedSha256: string;
}

async function enqueueDownload(input: EnqueueDownloadInput) {
  const result = await window.ycore.downloads.enqueue(input);
  if (isErr(result)) throw new Error(result.error.code);
  return result.value;
}

/** Hook de mutación de TanStack Query para encolar una descarga. */
export function useEnqueueDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enqueueDownload,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: downloadsQueryKey }),
  });
}
