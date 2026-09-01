/**
 * `globalSetup` del proyecto de tests `main` — crea `.tmp-tests/` antes de
 * que corra ningún test.
 *
 * Sirve porque varios tests (`downloads/*.test.ts`, `steam/watcher.test.ts`)
 * llaman `mkdtempSync(join('.tmp-tests', 'prefijo-'))`, y `mkdtempSync` de
 * Node exige que el directorio **padre** ya exista — no lo crea. En la
 * máquina de desarrollo `.tmp-tests/` sobrevive entre corridas (está
 * gitignoreado) y el bug queda invisible; en un checkout limpio de CI el
 * directorio no existe y cada test que lo usa falla con `ENOENT` antes de
 * llegar a su propio código (ver aprendizaje.md, 2026-09-01).
 */

import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// `process.cwd()`, no `__dirname`: es exactamente lo que ya usa cada test
// individual para construir `TMP_TESTS_ROOT` — mismo criterio, misma raíz.
const TMP_TESTS_ROOT = join(process.cwd(), '.tmp-tests');

export function setup(): void {
  mkdirSync(TMP_TESTS_ROOT, { recursive: true });
}

export function teardown(): void {
  rmSync(TMP_TESTS_ROOT, { recursive: true, force: true });
}
