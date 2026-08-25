/**
 * `parseDepotKeys` — lee las claves de descifrado de depots desde `config/config.vdf`.
 *
 * Sirve para saber qué depots tienen clave conocida — información de solo
 * lectura para Y-CORE en esta fase (sincronizar biblioteca, mostrar estado).
 * Escribir/inyectar claves en `config.vdf` es una operación mucho más
 * delicada (el v1 la hacía con cirugía de texto para preservar el formato
 * exacto que Steam espera, en vez de un parse+serialize completo) y
 * pertenece a una feature posterior (DRM/online-fix, Fase 8-9), no a la
 * sincronización de biblioteca de Fase 3.
 */

import { ok, type Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import { parseVdf, type VdfNode } from './vdf/parse-vdf.js';
import { childValue, findChild } from './vdf/vdf-node.js';

/** Mapa `depotId → clave de descifrado hex`. */
export type DepotKeys = ReadonlyMap<string, string>;

/**
 * Busca la sección `depots` en cualquier profundidad del árbol. Real
 * `config.vdf` la anida bajo `InstallConfigStore > Software > Valve > Steam`,
 * pero esa ruta exacta no es estable entre versiones del cliente — buscar
 * por nombre de sección (única, no ambigua) es más robusto que reproducir
 * toda la jerarquía intermedia.
 */
function findDepotsSection(node: VdfNode, depth = 0): VdfNode | undefined {
  if (depth > 64) return undefined;
  const direct = findChild(node, 'depots');
  if (direct !== undefined) return direct;

  for (const child of node.children ?? []) {
    if (child.children === undefined) continue;
    const found = findDepotsSection(child, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * @param vdfContent - Contenido crudo de `config/config.vdf`, ya leído.
 * @returns Las claves de depot conocidas. Un `config.vdf` recién instalado
 *   (sin ninguna compra todavía) no tiene sección `depots` — eso es un mapa
 *   vacío, no un error (el v1 documentó este caso explícitamente: la sección
 *   se crea de forma perezosa la primera vez que Steam la necesita).
 */
export function parseDepotKeys(vdfContent: string): Result<DepotKeys, AppError> {
  const parsedResult = parseVdf(vdfContent);
  if (parsedResult.ok === false) return parsedResult;

  const depots = findDepotsSection(parsedResult.value);
  if (depots?.children === undefined) return ok(new Map());

  const keys = new Map<string, string>();
  for (const depot of depots.children) {
    const key = childValue(depot, 'DecryptionKey');
    if (key !== undefined) keys.set(depot.key, key);
  }

  return ok(keys);
}
