/**
 * `Game` — un juego de Steam conocido por Y-CORE, instalado o no.
 *
 * Sirve como la entidad central de la feature Biblioteca (Fase 2 del roadmap):
 * lo que aparece en el grid, lo que se busca, lo que se lanza. Es un tipo
 * puro — sin métodos, sin I/O — para que `core-domain` sea testeable en
 * milisegundos y no dependa de Electron ni de `node:fs` (roadmap, sección A.3:
 * "core-domain y steam-kit sin Electron").
 *
 * La persistencia real (tabla Drizzle) vive en `apps/desktop/src/main/db` y se
 * mapea a/desde este tipo en el repositorio de la feature — `core-domain` no
 * sabe que existe una base de datos.
 */

/** Identificador único de Steam para una app (juego, DLC, herramienta, etc.). */
export type AppId = number;

/** Un juego de Steam conocido por Y-CORE. */
export interface Game {
  readonly appId: AppId;
  readonly name: string;
  /** `null` si el juego está en el catálogo pero no instalado en esta máquina. */
  readonly installation: Installation | null;
}

/** Dónde y cómo está instalado un juego en disco. */
export interface Installation {
  /** Ruta absoluta a la carpeta de instalación (p. ej. `...\steamapps\common\<juego>`). */
  readonly path: string;
  /**
   * Ruta absoluta al ejecutable a lanzar. Distinta de `path` porque la carpeta
   * de instalación casi nunca es directamente ejecutable — se resuelve leyendo
   * `appmanifest_*.acf`/`libraryfolders.vdf` (Fase 3, `packages/steam-kit`).
   * `null` mientras esa resolución no exista todavía: un juego puede estar
   * "instalado" (hay carpeta) sin que sepamos aún qué lanzar dentro de ella.
   */
  readonly executablePath: string | null;
  /** Tamaño en disco, en bytes. */
  readonly sizeOnDiskBytes: number;
  /** Fecha ISO 8601 de la última vez que se lanzó el juego, o `null` si nunca. */
  readonly lastPlayedAt: string | null;
}

/**
 * Construye un {@link Game} sin instalación. Sirve para el caso común de
 * poblar el catálogo antes de sincronizar contra el disco (Fase 3, steam-kit).
 *
 * @param appId - AppID de Steam.
 * @param name - Nombre del juego tal como lo reporta Steam.
 * @returns Un `Game` con `installation: null`.
 */
export function createUninstalledGame(appId: AppId, name: string): Game {
  return { appId, name, installation: null };
}

/** Type guard: distingue un `Game` instalado, estrechando `installation` a no-null. */
export function isInstalled(game: Game): game is Game & { installation: Installation } {
  return game.installation !== null;
}
