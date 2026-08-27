#!/usr/bin/env node
/**
 * check-worker-routes — garantiza un único punto de despacho en el update-worker.
 *
 * Verifica que `services/update-worker/src/` tiene exactamente un
 * `export default { fetch }` y ningún `addEventListener('fetch')` suelto. Es
 * el equivalente servidor de "un solo ipcMain.handle" (regla B.1): impide que
 * renazcan los dos caminos de actualización que tenía el v1 (ADR-0005, punto 1
 * y checker nº 1 de "Consecuencias").
 *
 * Uso:  pnpm check:worker-routes
 * Salida: exit 0 = ok · exit 1 = más de un fetch handler, o un addEventListener suelto
 *
 * Solo Node puro: se ejecuta en CI y en el hook de pre-commit.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const WORKER_SRC = join(REPO_ROOT, 'services', 'update-worker', 'src');

const DEFAULT_FETCH_EXPORT = /export\s+default\s*\{[^}]*\bfetch\s*[:(]/s;
const ADD_EVENT_LISTENER_FETCH = /addEventListener\(\s*['"]fetch['"]/;

/** Recorre `services/update-worker/src` recursivamente y devuelve las rutas de los `.ts`. */
function listTsFilesRecursive(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFilesRecursive(full));
    } else if (entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

if (!statSync(WORKER_SRC, { throwIfNoEntry: false })) {
  console.log('OK: check:worker-routes — services/update-worker/src no existe todavía, nada que verificar.');
  process.exit(0);
}

const files = listTsFilesRecursive(WORKER_SRC);
const filesWithFetchExport = [];
const filesWithAddEventListener = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (DEFAULT_FETCH_EXPORT.test(content)) filesWithFetchExport.push(file);
  if (ADD_EVENT_LISTENER_FETCH.test(content)) filesWithAddEventListener.push(file);
}

const problems = [];

if (filesWithFetchExport.length === 0) {
  problems.push('no se encontró ningún `export default { fetch }` en services/update-worker/src/.');
} else if (filesWithFetchExport.length > 1) {
  problems.push(
    `hay ${filesWithFetchExport.length} archivos con \`export default { fetch }\` — debe haber ` +
      `exactamente uno (ADR-0005, punto 1):\n` +
      filesWithFetchExport.map((f) => `      - ${f}`).join('\n'),
  );
}

if (filesWithAddEventListener.length > 0) {
  problems.push(
    `hay un \`addEventListener('fetch')\` suelto — el Worker usa el formato de módulo ES ` +
      `(export default { fetch }), no el formato de service worker antiguo:\n` +
      filesWithAddEventListener.map((f) => `      - ${f}`).join('\n'),
  );
}

if (problems.length > 0) {
  console.error('FALLO: check:worker-routes no pasó:\n');
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}

console.log('OK: check:worker-routes — un único export default { fetch } en services/update-worker.');
process.exit(0);
