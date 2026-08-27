/**
 * `UpdateBanner` — aviso de actualización, visible solo cuando hay algo que mostrar.
 *
 * Sirve como la única superficie de UI de la feature Updates: no hay pantalla
 * propia, solo un banner que aparece en `App.tsx` cuando la fase no es
 * `up-to-date`. En `up-to-date` no renderiza nada — la indistinguibilidad de
 * "estás al día" con "el servidor está en mantenimiento" (ADR-0003) es
 * exactamente el mismo silencio aquí.
 */

import { useUpdateStatusQuery } from '../hooks/use-update-status-query.js';
import { useInstallUpdate } from '../hooks/use-install-update.js';

export function UpdateBanner(): React.JSX.Element | null {
  const status = useUpdateStatusQuery();
  const install = useInstallUpdate();

  if (!status.isSuccess) return null;

  const { data } = status;
  if (data.phase === 'up-to-date') return null;

  if (data.phase === 'available') {
    return <p>Descargando la actualización a la versión {data.version}…</p>;
  }

  if (data.phase === 'downloading') {
    const percent = data.bytesTotal === null ? null : Math.round((data.bytesDownloaded / data.bytesTotal) * 100);
    return <p>Descargando actualización {data.version}{percent === null ? '' : ` (${percent}%)`}…</p>;
  }

  if (data.phase === 'ready-to-install') {
    return (
      <p>
        Hay una actualización lista: versión {data.version}.{' '}
        <button type="button" onClick={() => install.mutate()} disabled={install.isPending}>
          Instalar y reiniciar
        </button>
      </p>
    );
  }

  return <p>No se pudo completar la actualización. Se reintentará automáticamente.</p>;
}
