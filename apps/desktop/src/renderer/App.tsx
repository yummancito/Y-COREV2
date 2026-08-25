/**
 * `App` — pantalla raíz. Monta la única feature real hasta ahora (Biblioteca).
 *
 * Sin router todavía: solo hay una vista, así que TanStack Router se añade
 * cuando exista una segunda pantalla (Ajustes, Descargas, etc.) — decisión
 * local, no vale la pena la infraestructura de rutas sin nada que rutear.
 */

import { LibraryGrid } from './features/library/index.js';

export function App(): React.JSX.Element {
  return (
    <main>
      <h1>Y-CORE</h1>
      <LibraryGrid />
    </main>
  );
}
