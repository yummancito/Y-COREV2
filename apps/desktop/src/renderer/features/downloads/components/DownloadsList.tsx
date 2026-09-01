/**
 * `DownloadsList` — pantalla principal de la feature Descargas.
 *
 * Sirve para mostrar la cola completa y pausar/cancelar cada descarga. Lee
 * el progreso por polling (`useDownloadsQuery`, ver
 * `docs/02-features/downloads/decisions.md` para por qué no son eventos push).
 */

import { useCancelDownload } from '../hooks/use-cancel-download.js';
import { useDownloadsQuery } from '../hooks/use-downloads-query.js';
import { usePauseDownload } from '../hooks/use-pause-download.js';
import { DownloadRow } from './DownloadRow.js';
import { EnqueueDownloadForm } from './EnqueueDownloadForm.js';

export function DownloadsList(): React.JSX.Element {
  const downloads = useDownloadsQuery();
  const pause = usePauseDownload();
  const cancel = useCancelDownload();

  return (
    <>
      <EnqueueDownloadForm />
      {downloads.isPending && <p>Cargando descargas…</p>}
      {downloads.isError && <p>No se pudo cargar la cola de descargas: {downloads.error.message}</p>}
      {downloads.isSuccess && downloads.data.length === 0 && <p>No hay descargas en la cola.</p>}
      {downloads.isSuccess && downloads.data.length > 0 && (
        <ul>
          {downloads.data.map((download) => (
            <DownloadRow
              key={download.state.id}
              download={download}
              onPause={(id) => pause.mutate(id)}
              onCancel={(id) => cancel.mutate(id)}
            />
          ))}
        </ul>
      )}
    </>
  );
}
