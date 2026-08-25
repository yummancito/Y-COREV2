/**
 * Helpers compartidos por los tests de `library-scanner.ts` — construyen un
 * ACF real (con la forma exacta que produce Steam) y mockean
 * `findSteamInstallPath` para apuntar a un directorio temporal real, sin
 * mockear `node:fs` (el escaneo se prueba contra el sistema de archivos real).
 */

import { vi } from 'vitest';

/** Construye el contenido de un `appmanifest_*.acf` real. */
export function realAcf(appId: string, name: string, installDir: string, sizeOnDisk = 1000): string {
  return `
    "AppState"
    {
      "appid"		"${appId}"
      "name"		"${name}"
      "installdir"		"${installDir}"
      "SizeOnDisk"		"${sizeOnDisk}"
      "LastPlayed"		"1700000000"
    }
  `;
}

/** Apunta `findSteamInstallPath` (mockeado) a un `steamRoot` de verdad en disco. */
export async function mockSteamInstallPath(steamRoot: string): Promise<void> {
  const { findSteamInstallPath } = await import('../../platform/steam-registry.js');
  vi.mocked(findSteamInstallPath).mockResolvedValue({ ok: true, value: steamRoot });
}
