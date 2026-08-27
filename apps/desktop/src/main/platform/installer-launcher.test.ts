import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { spawnSilentInstaller } from './installer-launcher.js';

describe('spawnSilentInstaller', () => {
  it('caso feliz: lanza un proceso real (cmd.exe) con el flag /S', () => {
    const result = spawnSilentInstaller('cmd.exe');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBeUndefined();
  });

  it('instalador inexistente: devuelve AppError io.failed y el fallo asíncrono (ENOENT) no se propaga como excepción no controlada', async () => {
    const result = spawnSilentInstaller('C:\\ruta\\que\\no\\existe\\nunca.exe');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('io.failed');

    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});
