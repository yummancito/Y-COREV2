/**
 * Helpers de navegación sobre el árbol `VdfNode` que devuelve {@link parseVdf}.
 *
 * Sirve para no obligar a cada consumidor (parser de libraryfolders, de ACF,
 * etc.) a recorrer `children` a mano. VDF permite claves duplicadas dentro de
 * una sección (Valve lo usa así de verdad), así que `findChild` devuelve solo
 * la primera coincidencia — cuando hace falta ver todas, usa `findChildren`.
 */

import type { VdfNode } from './parse-vdf.js';

/**
 * Busca el primer hijo directo de `node` cuya clave coincida (sin distinguir
 * mayúsculas/minúsculas — VDF real de Steam mezcla `AppState`/`appstate`
 * según la versión del cliente que lo escribió).
 */
export function findChild(node: VdfNode, key: string): VdfNode | undefined {
  const lowerKey = key.toLowerCase();
  return node.children?.find((child) => child.key.toLowerCase() === lowerKey);
}

/** Todos los hijos directos de `node` cuya clave coincida (para secciones con duplicados). */
export function findChildren(node: VdfNode, key: string): VdfNode[] {
  const lowerKey = key.toLowerCase();
  return node.children?.filter((child) => child.key.toLowerCase() === lowerKey) ?? [];
}

/** Valor de un hijo hoja, o `undefined` si no existe o es una sección. */
export function childValue(node: VdfNode, key: string): string | undefined {
  return findChild(node, key)?.value;
}

/** Como {@link childValue}, pero parsea el resultado como entero en base 10. Ignora valores no numéricos. */
export function childValueAsInt(node: VdfNode, key: string): number | undefined {
  const raw = childValue(node, key);
  if (raw === undefined) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
