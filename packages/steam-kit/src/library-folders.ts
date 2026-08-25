/**
 * `parseLibraryFolders` — resuelve las carpetas de biblioteca de Steam desde
 * el contenido de `steamapps/libraryfolders.vdf`.
 *
 * Sirve porque Steam permite instalar juegos en varios discos: cada carpeta
 * de biblioteca adicional tiene su propio `steamapps/appmanifest_*.acf`. Sin
 * esto, Y-CORE solo vería los juegos de la biblioteca principal.
 *
 * El formato cambió entre versiones del cliente de Steam (v1 lo documentó
 * como "FIX #2"): las versiones viejas guardaban la ruta directo como valor
 * de una clave numérica (`"0" "C:\\Steam"`); las versiones modernas anidan
 * una sección con `.path`, `.label`, `.contentid`, `.apps`, etc. Este parser
 * soporta ambas formas. Las claves `contentroot`/`packages` que a veces
 * aparecen junto a las entradas numéricas no son bibliotecas — se ignoran.
 */

import { ok, type Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import { parseVdf } from './vdf/parse-vdf.js';
import { childValue, findChild } from './vdf/vdf-node.js';
import type { VdfNode } from './vdf/parse-vdf.js';

/** Claves de nivel superior dentro de `libraryfolders` que no son bibliotecas. */
const NON_LIBRARY_KEYS = new Set(['contentroot', 'packages']);

/** Extrae la ruta de una entrada de biblioteca, en formato viejo (valor directo) o moderno (`.path`). */
function extractPath(entry: VdfNode): string | undefined {
  if (entry.value !== undefined) return entry.value;
  return childValue(entry, 'path');
}

/**
 * Parsea el contenido de `libraryfolders.vdf` y devuelve las rutas de todas
 * las carpetas de biblioteca declaradas.
 *
 * @param vdfContent - Contenido crudo del archivo, ya leído.
 * @returns Las rutas encontradas (puede ser un array vacío si el archivo no
 *   declara ninguna biblioteca válida), o `AppError` si el VDF es inválido.
 *   Nunca falla por "no hay ninguna biblioteca" — un array vacío es un
 *   resultado legítimo, el llamador decide si eso amerita un fallback a la
 *   biblioteca principal conocida por otro medio (main/platform, Fase 3+).
 */
export function parseLibraryFolders(vdfContent: string): Result<string[], AppError> {
  const parsedResult = parseVdf(vdfContent);
  if (parsedResult.ok === false) return parsedResult;

  const root = findChild(parsedResult.value, 'libraryfolders');
  if (root?.children === undefined) return ok([]);

  const paths: string[] = [];
  for (const entry of root.children) {
    if (NON_LIBRARY_KEYS.has(entry.key.toLowerCase())) continue;
    const path = extractPath(entry);
    if (path !== undefined && path !== '') paths.push(path);
  }

  return ok(paths);
}
