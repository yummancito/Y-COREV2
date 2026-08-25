import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr } from '@ycore/result';
import { extractZip } from './extractor.js';
import { buildMaliciousZip, buildZip } from './extractor.test-helpers.js';

const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');

describe('extractZip — seguridad y atomicidad', () => {
  let dir: string;
  let zipPath: string;
  let installPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(TMP_TESTS_ROOT, 'extractor-sec-'));
    zipPath = join(dir, 'archive.zip');
    installPath = join(dir, 'install');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reemplaza un installPath anterior en vez de mezclar archivos viejos y nuevos', async () => {
    mkdirSync(installPath, { recursive: true });
    writeFileSync(join(installPath, 'viejo.txt'), 'obsoleto');
    await buildZip(zipPath, { 'nuevo.txt': 'fresco' });

    await extractZip(zipPath, installPath);

    expect(existsSync(join(installPath, 'viejo.txt'))).toBe(false);
    expect(readFileSync(join(installPath, 'nuevo.txt'), 'utf8')).toBe('fresco');
  });

  it('rechaza un ZIP con una entrada que se sale de installPath (zip-slip)', async () => {
    buildMaliciousZip(zipPath, '../../evil.exe', 'malware');

    const result = await extractZip(zipPath, installPath);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('download.zip-slip');
    expect(existsSync(join(dir, '..', 'evil.exe'))).toBe(false);
  });
});
