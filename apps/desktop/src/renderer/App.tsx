/**
 * `App` — pantalla raíz. Monta las features reales hasta ahora (Biblioteca y Descargas).
 *
 * Sin router todavía: ambas secciones se muestran juntas en una sola
 * pantalla en vez de rutas separadas. TanStack Router se añade cuando el
 * número de secciones haga falta navegación real (decisión local, no vale
 * la pena la infraestructura de rutas para dos bloques en la misma pantalla).
 */

import { DownloadsList } from './features/downloads/index.js';
import { LibraryGrid } from './features/library/index.js';

export function App(): React.JSX.Element {
  return (
    <main>
      <h1>Y-CORE</h1>
      <LibraryGrid />
      <h2>Descargas</h2>
      <DownloadsList />
    </main>
  );
}
