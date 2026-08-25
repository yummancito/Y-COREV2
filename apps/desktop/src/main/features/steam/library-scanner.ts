/**
 * `scanSteamLibrary` — importa la biblioteca real de Steam desde disco.
 *
 * Sirve para convertir lo que hay instalado en esta máquina (carpetas de
 * biblioteca + `appmanifest_*.acf`) en `Game[]` de `@ycore/core-domain`,
 * listos para guardarse en la tabla `games` vía `LibraryRepository`
 * (`main/features/library`). Es el único lugar de `main/features/steam` que
 * toca disco — usa `parseLibraryFolders`/`parseAppManifest` de
 * `@ycore/steam-kit` (puro) para interpretar lo que lee.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ok, type Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import type { Game } from '@ycore/core-domain';
import { parseAppManifest, parseLibraryFolders } from '@ycore/steam-kit';
import { createLogger } from '@ycore/logger';
import { findSteamInstallPath } from '../../platform/steam-registry.js';

const log = createLogger('main:features:steam:library-scanner');

const APP_MANIFEST_PATTERN = /^appmanifest_(\d+)\.acf$/;

/** Convierte segundos-epoch (como los guarda Steam) a ISO 8601, o `null` si es cero (nunca jugado). */
function secondsToIso(seconds: number): string | null {
  return seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Lee y parsea todos los `appmanifest_*.acf` de una carpeta `steamapps`. Un
 * ACF individual corrupto o ilegible se salta con un aviso en el log — no
 * debe tumbar la importación completa por un solo archivo dañado.
 */
async function readAppManifestsFrom(steamAppsDir: string): Promise<Game[]> {
  let entries: string[];
  try {
    entries = await readdir(steamAppsDir);
  } catch (error) {
    log.warn('no se pudo leer la carpeta steamapps', { steamAppsDir, detail: String(error) });
    return [];
  }

  const games: Game[] = [];
  for (const entry of entries) {
    if (!APP_MANIFEST_PATTERN.test(entry)) continue;

    const manifestPath = join(steamAppsDir, entry);
    const content = await readFile(manifestPath, 'utf8').catch(() => null);
    if (content === null) {
      log.warn('no se pudo leer un appmanifest', { manifestPath });
      continue;
    }

    const parsed = parseAppManifest(content);
    if (parsed.ok === false) {
      log.warn('appmanifest corrupto, se ignora', { manifestPath, code: parsed.error.code });
      continue;
    }

    const manifest = parsed.value;
    games.push({
      appId: Number.parseInt(manifest.appId, 10),
      name: manifest.name,
      installation: {
        path: join(steamAppsDir, 'common', manifest.installDir),
        executablePath: null,
        sizeOnDiskBytes: manifest.sizeOnDiskBytes,
        lastPlayedAt: secondsToIso(manifest.lastPlayedAtSeconds),
      },
    });
  }
  return games;
}

/**
 * Resuelve las carpetas `steamapps` a escanear: la principal (derivada de la
 * ruta de instalación de Steam) más todas las declaradas en
 * `libraryfolders.vdf`. Un fallo al leer/parsear `libraryfolders.vdf` no es
 * fatal — se sigue con solo la biblioteca principal, igual que documentó el
 * v1 ("graceful degradation": nunca menos de una biblioteca disponible).
 *
 * Se exporta porque `watcher.ts` la reutiliza para saber qué carpetas vigilar
 * — evita que el watcher reimplemente su propia resolución de bibliotecas.
 *
 * @param steamPath - Ruta de instalación de Steam (de {@link findSteamInstallPath}).
 * @returns Al menos la carpeta `steamapps` principal; nunca un array vacío.
 */
export async function resolveSteamAppsDirs(steamPath: string): Promise<string[]> {
  const primary = join(steamPath, 'steamapps');
  const libraryFoldersPath = join(primary, 'libraryfolders.vdf');

  const content = await readFile(libraryFoldersPath, 'utf8').catch(() => null);
  if (content === null) return [primary];

  const parsed = parseLibraryFolders(content);
  if (parsed.ok === false) return [primary];

  const extraDirs = parsed.value.map((libraryPath) => join(libraryPath, 'steamapps'));
  return [primary, ...extraDirs];
}

/**
 * Escanea la biblioteca de Steam de esta máquina y devuelve todos los
 * juegos instalados encontrados.
 *
 * @returns Un array de `Game` (puede estar vacío si no hay ningún juego
 *   instalado), o `AppError` `not-found` si Steam mismo no está instalado.
 */
export async function scanSteamLibrary(): Promise<Result<Game[], AppError>> {
  const steamPathResult = await findSteamInstallPath();
  if (steamPathResult.ok === false) return steamPathResult;

  const steamAppsDirs = await resolveSteamAppsDirs(steamPathResult.value);
  const gamesByDir = await Promise.all(steamAppsDirs.map(readAppManifestsFrom));

  return ok(gamesByDir.flat());
}
