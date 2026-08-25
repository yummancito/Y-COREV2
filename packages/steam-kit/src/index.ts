/**
 * `steam-kit` — parsers puros de formatos de Steam (Fase 3 del roadmap).
 *
 * Sirve como el único lugar del repo que sabe leer VDF/ACF. Recibe siempre
 * contenido ya leído, nunca una ruta — no importa Electron ni `node:fs`
 * (roadmap, sección A.3), para que sea testeable en milisegundos y portable
 * a cualquier proceso. La resolución de rutas reales en disco (dónde está
 * Steam instalado, qué archivos leer) vive en `main/features/steam`
 * (`apps/desktop`), que sí puede tocar el SO.
 */

export { parseVdf, type VdfNode } from './vdf/parse-vdf.js';
export { findChild, findChildren, childValue, childValueAsInt } from './vdf/vdf-node.js';

export { parseLibraryFolders } from './library-folders.js';
export { parseAppManifest, needsRepair, type AppManifest } from './app-manifest.js';
export { parseLoginUsers } from './login-users.js';
export { parseDepotKeys, type DepotKeys } from './depot-keys.js';
