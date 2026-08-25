import { afterEach, describe, expect, it, vi } from 'vitest';
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

type ExecFileCallback = (error: Error | null, result?: { stdout: string; stderr: string }) => void;

function mockExecFile(handler: (args: string[]) => { stdout: string } | Error) {
  vi.doMock('node:child_process', () => ({
    execFile: (_cmd: string, args: string[], callback: ExecFileCallback) => {
      const outcome = handler(args);
      if (outcome instanceof Error) callback(outcome);
      else callback(null, { stdout: outcome.stdout, stderr: '' });
    },
  }));
}

describe('findSteamInstallPath — con reg.exe mockeado', () => {
  afterEach(() => {
    vi.doUnmock('node:child_process');
    vi.resetModules();
  });

  it('normaliza forward slashes a backslashes (Steam escribe SteamPath con /)', async () => {
    mockExecFile(() => ({
      stdout:
        'HKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n',
    }));

    const { findSteamInstallPath: mockedFind } = await import('./steam-registry.js');
    const result = await mockedFind();

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('c:\\program files (x86)\\steam');
  });

  it('cae a HKLM InstallPath si HKCU SteamPath no existe', async () => {
    mockExecFile((args) => {
      if (args.includes('HKCU\\Software\\Valve\\Steam')) {
        return new Error('el sistema no puede encontrar la clave especificada');
      }
      return {
        stdout:
          'HKEY_LOCAL_MACHINE\\SOFTWARE\\Valve\\Steam\r\n    InstallPath    REG_SZ    C:\\Program Files (x86)\\Steam\r\n',
      };
    });

    const { findSteamInstallPath: mockedFind } = await import('./steam-registry.js');
    const result = await mockedFind();

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('C:\\Program Files (x86)\\Steam');
  });

  it('devuelve AppError not-found si ninguna de las dos claves existe (Steam no instalado)', async () => {
    mockExecFile(() => new Error('el sistema no puede encontrar la clave especificada'));

    const { findSteamInstallPath: mockedFind } = await import('./steam-registry.js');
    const result = await mockedFind();

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });
});
