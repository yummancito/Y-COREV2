/**
 * `parseAppManifest` — parsea el contenido de un `appmanifest_<appId>.acf`.
 *
 * Sirve para saber qué juego representa el archivo, dónde está instalado, y
 * si la instalación quedó a medias (interrumpida, corrupta) — el caso que el
 * v1 llamaba "shouldRepairAcf": Steam deja `StateFlags` en una combinación
 * específica cuando una descarga se interrumpió a mitad de camino.
 */

import { err, ok, type Result } from '@ycore/result';
import { appError, type AppError } from '@ycore/result/app-error';
import { parseVdf } from './vdf/parse-vdf.js';
import { childValue, childValueAsInt, findChild } from './vdf/vdf-node.js';

/** Datos extraídos de un `appmanifest_*.acf` que Y-CORE necesita. */
export interface AppManifest {
  readonly appId: string;
  readonly name: string;
  readonly installDir: string;
  readonly stateFlags: number;
  readonly sizeOnDiskBytes: number;
  readonly lastUpdatedAtSeconds: number;
  readonly lastPlayedAtSeconds: number;
  readonly buildId: string;
}

/**
 * Combinaciones de `StateFlags` que Steam deja cuando una instalación quedó
 * a medias — descarga interrumpida a mitad de camino. Documentado en el v1
 * como "shouldRepairAcf": 4 = "update required", 36 = variante con más bits
 * de "fully installed but corrupt-ish" activados a la vez.
 */
const INCOMPLETE_STATE_FLAGS = new Set([4, 36]);

/**
 * Parsea el contenido de un `appmanifest_*.acf`.
 *
 * @param acfContent - Contenido crudo del archivo, ya leído.
 * @returns El manifiesto parseado, o `AppError`: `io.failed` si el VDF es
 *   inválido, `not-found` si el VDF es válido pero no tiene sección
 *   `AppState` (ACF corrupto/vacío — el v1 lo trataba como corrupción real,
 *   no como "no es un ACF", porque todo `appmanifest_*.acf` real de Steam
 *   siempre tiene `AppState` como raíz).
 */
export function parseAppManifest(acfContent: string): Result<AppManifest, AppError> {
  const parsedResult = parseVdf(acfContent);
  if (parsedResult.ok === false) return parsedResult;

  const appState = findChild(parsedResult.value, 'AppState');
  if (appState === undefined) {
    return err(appError('not-found', { detail: 'el ACF no tiene sección AppState' }));
  }

  const appId = childValue(appState, 'appid');
  if (appId === undefined) {
    return err(appError('not-found', { detail: 'el ACF no tiene appid' }));
  }

  return ok({
    appId,
    name: childValue(appState, 'name') ?? '',
    installDir: childValue(appState, 'installdir') ?? '',
    stateFlags: childValueAsInt(appState, 'StateFlags') ?? 0,
    sizeOnDiskBytes: childValueAsInt(appState, 'SizeOnDisk') ?? 0,
    lastUpdatedAtSeconds: childValueAsInt(appState, 'LastUpdated') ?? 0,
    lastPlayedAtSeconds: childValueAsInt(appState, 'LastPlayed') ?? 0,
    buildId: childValue(appState, 'buildid') ?? '',
  });
}

/**
 * @returns `true` si la combinación de `stateFlags`/`sizeOnDiskBytes` indica
 *   una instalación interrumpida que Steam necesita reparar (descargar de
 *   nuevo o verificar archivos), según la heurística documentada en el v1.
 */
export function needsRepair(manifest: AppManifest): boolean {
  return INCOMPLETE_STATE_FLAGS.has(manifest.stateFlags) && manifest.sizeOnDiskBytes === 0;
}
