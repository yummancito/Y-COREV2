/**
 * `App` — pantalla raíz. Monta las features reales hasta ahora (Biblioteca,
 * Descargas y Ajustes).
 *
 * Sin router todavía: todas las secciones se muestran juntas en una sola
 * pantalla en vez de rutas separadas. TanStack Router se añade cuando el
 * número de secciones haga falta navegación real (decisión local, no vale
 * la pena la infraestructura de rutas para tres bloques en la misma pantalla).
 */

import { DownloadsList } from './features/downloads/index.js';
import { LibraryGrid } from './features/library/index.js';
import { UpdateBanner } from './features/updates/index.js';
import { SettingsPanel } from './features/settings/index.js';

export function App(): React.JSX.Element {
  return (
    <main>
      <h1>Y-CORE</h1>
      <UpdateBanner />
      <LibraryGrid />
      <h2>Descargas</h2>
      <DownloadsList />
      <SettingsPanel />
    </main>
  );
}
