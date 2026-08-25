/**
 * `findSteamInstallPath` — resuelve dónde está instalado Steam en esta máquina.
 *
 * Sirve como el único lugar del repo que lee el registro de Windows para
 * Steam (roadmap, sección A.3 — "platform/ único sitio que habla con el SO").
 * Usa `reg.exe query` vía `child_process` en vez de un paquete con binding
 * nativo — ya hubo problemas serios de ABI con `better-sqlite3` (ver
 * aprendizaje.md); `reg.exe` viene con Windows, cero riesgo de compilación.
 *
 * Orden de resolución (documentado en el v1 como el orden real que usa el
 * cliente de Steam):
 *   1. `HKEY_CURRENT_USER\Software\Valve\Steam\SteamPath` — instalación del
 *      usuario actual, la más común y la más confiable.
 *   2. `HKEY_LOCAL_MACHINE\SOFTWARE\Valve\Steam\InstallPath` — instalación a
 *      nivel de sistema (poco común, pero existe en instalaciones antiguas
 *      o gestionadas por IT).
 * Steam escribe `SteamPath` con forward slashes (`c:/program files (x86)/
 * steam`) aunque estemos en Windows — hay que normalizar antes de usarla
 * como ruta real.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { err, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';

const execFileAsync = promisify(execFile);

interface RegistryTarget {
  readonly hive: 'HKCU' | 'HKLM';
  readonly key: string;
  readonly valueName: string;
}

const REGISTRY_TARGETS: readonly RegistryTarget[] = [
  { hive: 'HKCU', key: 'Software\\Valve\\Steam', valueName: 'SteamPath' },
  { hive: 'HKLM', key: 'SOFTWARE\\Valve\\Steam', valueName: 'InstallPath' },
];

/**
 * Extrae el valor de una línea de salida de `reg query /v <nombre>`. La
 * línea real tiene la forma `    SteamPath    REG_SZ    c:/steam` — el valor
 * puede contener espacios, así que se captura todo lo que sigue al tipo.
 */
function extractRegistryValue(stdout: string, valueName: string): string | undefined {
  const pattern = new RegExp(`^\\s*${valueName}\\s+REG_SZ\\s+(.+)$`, 'mi');
  const match = pattern.exec(stdout);
  return match?.[1]?.trim();
}

/** Consulta una única clave del registro. `undefined` si no existe (no es un error). */
async function readRegistryValue(target: RegistryTarget): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('reg', [
      'query',
      `${target.hive}\\${target.key}`,
      '/v',
      target.valueName,
    ]);
    return extractRegistryValue(stdout, target.valueName);
  } catch {
    // reg.exe sale con código de error si la clave no existe — es el caso
    // esperado en una máquina sin Steam instalado, no un fallo real.
    return undefined;
  }
}

/** Normaliza forward slashes a backslashes — Steam guarda SteamPath con `/`. */
function normalizeWindowsPath(rawPath: string): string {
  return rawPath.replace(/\//g, '\\');
}

/**
 * Busca la ruta de instalación de Steam en el registro de Windows.
 *
 * @returns La ruta normalizada (backslashes), o `AppError` `not-found` si
 *   ninguna de las dos claves conocidas existe — significa que Steam no está
 *   instalado en esta máquina, no que hubo un fallo al leer el registro.
 */
export async function findSteamInstallPath(): Promise<Result<string, AppError>> {
  try {
    for (const target of REGISTRY_TARGETS) {
      const value = await readRegistryValue(target);
      if (value !== undefined && value !== '') return ok(normalizeWindowsPath(value));
    }
    return err(appError('not-found', { detail: 'Steam no está instalado (sin claves de registro conocidas)' }));
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
}
