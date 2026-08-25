import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { IncrementalHasher, hashFileSha256, verifyFileSha256 } from './verifier.js';

// Ruta larga bajo el propio repo, no os.tmpdir(): evita el short-path 8.3
// que ya rompió otro watcher de archivos en este entorno (ver aprendizaje.md).
const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');

describe('IncrementalHasher', () => {
  it('produce el mismo hash que node:crypto sobre el mismo contenido', () => {
    const content = Buffer.from('hello world');
    const expected = createHash('sha256').update(content).digest('hex');

    const hasher = new IncrementalHasher();
    hasher.update(content.subarray(0, 5));
    hasher.update(content.subarray(5));

    expect(hasher.digestHex()).toBe(expected);
  });
});

describe('hashFileSha256 y verifyFileSha256', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'verifier-'));
    filePath = join(dir, 'file.bin');
    writeFileSync(filePath, 'hello world');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('hashFileSha256 calcula el hash real del archivo', async () => {
    const expected = createHash('sha256').update('hello world').digest('hex');

    const result = await hashFileSha256(filePath);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe(expected);
  });

  it('hashFileSha256 devuelve io.failed si el archivo no existe', async () => {
    const result = await hashFileSha256(join(dir, 'no-existe.bin'));

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('io.failed');
  });

  it('verifyFileSha256 pasa si el hash coincide (sin importar mayúsculas)', async () => {
    const expected = createHash('sha256').update('hello world').digest('hex');

    const result = await verifyFileSha256(filePath, expected.toUpperCase());

    expect(isOk(result)).toBe(true);
  });

  it('verifyFileSha256 devuelve download.integrity-mismatch si no coincide', async () => {
    const result = await verifyFileSha256(filePath, 'f'.repeat(64));

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('download.integrity-mismatch');
  });
});
