/**
 * `DownloadRow` — una fila de la cola de descargas.
 *
 * Sirve para mostrar el estado y progreso de una descarga y disparar
 * pausar/cancelar. Componente puro respecto a datos: recibe el `download`
 * ya resuelto por `useDownloadsQuery`, no hace fetching propio.
 */

/** Forma mínima de una descarga tal como la devuelve `downloads.list`. */
interface DownloadShape {
  readonly appId: number;
  readonly state:
    | { readonly id: string; readonly status: 'queued' }
    | { readonly id: string; readonly status: 'downloading'; readonly bytesDownloaded: number; readonly bytesTotal: number | null }
    | { readonly id: string; readonly status: 'paused'; readonly bytesDownloaded: number; readonly bytesTotal: number | null }
    | { readonly id: string; readonly status: 'verifying' }
    | { readonly id: string; readonly status: 'extracting' }
    | { readonly id: string; readonly status: 'installing' }
    | { readonly id: string; readonly status: 'done' }
    | { readonly id: string; readonly status: 'failed'; readonly error: { readonly code: string } };
}

interface DownloadRowProps {
  readonly download: DownloadShape;
  readonly onPause: (id: string) => void;
  readonly onCancel: (id: string) => void;
}

const STATUS_LABELS: Record<DownloadShape['state']['status'], string> = {
  queued: 'En cola',
  downloading: 'Descargando',
  paused: 'Pausado',
  verifying: 'Verificando',
  extracting: 'Extrayendo',
  installing: 'Instalando',
  done: 'Completado',
  failed: 'Falló',
};

/** Porcentaje 0-100, o `null` si no hay `bytesTotal` conocido todavía. */
function progressPercent(state: DownloadShape['state']): number | null {
  if (state.status !== 'downloading' && state.status !== 'paused') return null;
  if (state.bytesTotal === null || state.bytesTotal === 0) return null;
  return Math.round((state.bytesDownloaded / state.bytesTotal) * 100);
}

export function DownloadRow({ download, onPause, onCancel }: DownloadRowProps): React.JSX.Element {
  const { state } = download;
  const percent = progressPercent(state);
  const canPause = state.status === 'downloading';
  const canCancel = state.status !== 'done';

  return (
    <li>
      <span>AppID {download.appId}</span>
      <span>{STATUS_LABELS[state.status]}</span>
      {percent !== null && (
        <progress value={percent} max={100}>
          {percent}%
        </progress>
      )}
      {state.status === 'failed' && <span role="alert">Error: {state.error.code}</span>}
      <button type="button" disabled={!canPause} onClick={() => onPause(state.id)}>
        Pausar
      </button>
      <button type="button" disabled={!canCancel} onClick={() => onCancel(state.id)}>
        Cancelar
      </button>
    </li>
  );
}
