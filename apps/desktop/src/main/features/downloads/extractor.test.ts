import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { extractZip } from './extractor.js';
import { buildZip, buildZipWithEmptyDir } from './extractor.test-helpers.js';

// Ruta larga bajo el propio repo, no os.tmpdir(): evita el short-path 8.3
// que ya rompió otro watcher de archivos en este entorno (ver aprendizaje.md).
const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');

describe('extractZip — caso feliz', () => {
  let dir: string;
  let zipPath: string;
  let installPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'extractor-'));
    zipPath = join(dir, 'archive.zip');
    installPath = join(dir, 'install');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('extrae archivos y carpetas anidadas a installPath', async () => {
    await buildZip(zipPath, {
      'readme.txt': 'hola',
      'bin/game.exe': 'contenido binario simulado',
    });

    const result = await extractZip(zipPath, installPath);

    expect(isOk(result)).toBe(true);
    expect(readFileSync(join(installPath, 'readme.txt'), 'utf8')).toBe('hola');
    expect(readFileSync(join(installPath, 'bin', 'game.exe'), 'utf8')).toBe('contenido binario simulado');
  });

  it('crea una carpeta vacía declarada explícitamente en el ZIP', async () => {
    await buildZipWithEmptyDir(zipPath, 'saves/');

    const result = await extractZip(zipPath, installPath);

    expect(isOk(result)).toBe(true);
    expect(existsSync(join(installPath, 'saves'))).toBe(true);
  });

  it('no deja restos de la carpeta .staging tras una extracción exitosa', async () => {
    await buildZip(zipPath, { 'readme.txt': 'hola' });

    await extractZip(zipPath, installPath);

    expect(existsSync(`${installPath}.staging`)).toBe(false);
  });

  it('devuelve io.failed si el ZIP no existe', async () => {
    const result = await extractZip(join(dir, 'no-existe.zip'), installPath);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('io.failed');
  });
});
