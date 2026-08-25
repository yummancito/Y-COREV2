/**
 * Helpers compartidos por los tests de `main/db` — crear/limpiar un
 * directorio temporal real para abrir bases SQLite de verdad en cada test,
 * sin mockear `better-sqlite3` (una migración solo se verifica de verdad
 * corriéndola contra un archivo real).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const MIGRATIONS_FOLDER = join(import.meta.dirname, 'migrations');

/** Crea un directorio temporal único para un test. Bórralo con `cleanupTempDir`. */
export function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'ycore-db-test-'));
}

/** Borra el directorio temporal. Llamar siempre en `afterEach`. */
export function cleanupTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
