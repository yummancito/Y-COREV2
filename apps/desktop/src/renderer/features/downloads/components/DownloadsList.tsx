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

export function DownloadsList(): React.JSX.Element {
  const downloads = useDownloadsQuery();
  const pause = usePauseDownload();
  const cancel = useCancelDownload();

  if (downloads.isPending) return <p>Cargando descargas…</p>;
  if (downloads.isError) return <p>No se pudo cargar la cola de descargas: {downloads.error.message}</p>;

  if (downloads.data.length === 0) {
    return <p>No hay descargas en la cola.</p>;
  }

  return (
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
  );
}
