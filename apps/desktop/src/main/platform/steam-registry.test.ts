import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { findSteamInstallPath } from './steam-registry.js';

describe('findSteamInstallPath — contra el registro real de esta máquina', () => {
  it('si Steam está instalado, devuelve una ruta normalizada con backslashes', async () => {
    const result = await findSteamInstallPath();

    // Esta máquina puede o no tener Steam instalado — ambos son resultados
    // válidos del mundo real, así que el test verifica la FORMA de cada uno
    // en vez de forzar un resultado fijo.
    if (isOk(result)) {
      expect(result.value).not.toContain('/');
      expect(result.value.length).toBeGreaterThan(0);
    } else {
      expect(result.error.code).toBe('not-found');
    }
  });
});

/**
 * `execFileAsync` inyectado directamente (ver `steam-registry.ts`), no
 * `vi.mock('node:child_process')` + import dinámico: ese patrón resultó
 * frágil entre entornos — pasaba siempre en local pero falló en el runner
 * de CI, aparentemente por una carrera entre el cache de módulos de Vitest
 * y otro archivo que también mockea `steam-registry.js` completo
 * (`watcher.test.ts`, con `vi.mock` estático). Inyectar la dependencia como
 * parámetro elimina esa clase de problema por completo — ver
 * `aprendizaje.md`, 2026-09-01.
 */
function fakeExecFileAsync(handler: (args: readonly string[]) => { stdout: string } | Error) {
  return (_file: string, args: readonly string[]): Promise<{ stdout: string; stderr: string }> => {
    const outcome = handler(args);
    if (outcome instanceof Error) return Promise.reject(outcome);
    return Promise.resolve({ stdout: outcome.stdout, stderr: '' });
  };
}

describe('findSteamInstallPath — con reg.exe inyectado', () => {
  it('normaliza forward slashes a backslashes (Steam escribe SteamPath con /)', async () => {
    const execFileAsync = fakeExecFileAsync(() => ({
      stdout:
        'HKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n',
    }));

    const result = await findSteamInstallPath(execFileAsync);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('c:\\program files (x86)\\steam');
  });

  it('cae a HKLM InstallPath si HKCU SteamPath no existe', async () => {
    const execFileAsync = fakeExecFileAsync((args) => {
      if (args.includes('HKCU\\Software\\Valve\\Steam')) {
        return new Error('el sistema no puede encontrar la clave especificada');
      }
      return {
        stdout:
          'HKEY_LOCAL_MACHINE\\SOFTWARE\\Valve\\Steam\r\n    InstallPath    REG_SZ    C:\\Program Files (x86)\\Steam\r\n',
      };
    });

    const result = await findSteamInstallPath(execFileAsync);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('C:\\Program Files (x86)\\Steam');
  });

  it('devuelve AppError not-found si ninguna de las dos claves existe (Steam no instalado)', async () => {
    const execFileAsync = fakeExecFileAsync(() => new Error('el sistema no puede encontrar la clave especificada'));

    const result = await findSteamInstallPath(execFileAsync);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });
});
