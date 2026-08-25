import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { spawnDetached } from './process-launcher.js';
import type { LaunchCommand } from '@ycore/core-domain';

describe('spawnDetached', () => {
  it('caso feliz: lanza un proceso real (cmd.exe) y devuelve su pid', () => {
    const command: LaunchCommand = {
      executablePath: 'cmd.exe',
      args: ['/c', 'exit'],
      cwd: process.cwd(),
    };

    const result = spawnDetached(command);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.pid).toBeGreaterThan(0);
  });

  it('ejecutable inexistente: devuelve AppError io.failed y el fallo asíncrono (ENOENT) no se propaga como excepción no controlada', async () => {
    const command: LaunchCommand = {
      executablePath: 'C:\\ruta\\que\\no\\existe\\nunca.exe',
      args: [],
      cwd: process.cwd(),
    };

    const result = spawnDetached(command);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('io.failed');

    // Deja correr el event loop para que el listener 'error' interno de
    // process-launcher.ts absorba el ENOENT asíncrono sin relanzarlo — si no
    // lo absorbiera, este test fallaría con un "Unhandled Error".
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});
