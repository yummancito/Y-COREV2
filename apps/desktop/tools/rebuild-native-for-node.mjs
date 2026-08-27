#!/usr/bin/env node
/**
 * rebuild-native-for-node — vuelve a activar el binding de better-sqlite3
 * compilado para Node normal, tras haber usado `rebuild:native:electron`.
 *
 * Sirve porque los tests (`pnpm test`, vía Vitest bajo Node) necesitan el
 * binding de Node, no el de Electron — ver rebuild-native-for-electron.mjs
 * para la explicación completa de por qué no pueden coexistir en el mismo
 * `build/Release/better_sqlite3.node`.
 *
 * Uso: pnpm --filter @ycore/desktop rebuild:native:node
 */

import { execFileSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const DESKTOP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);

const BSQLITE_ROOT = dirname(
  require.resolve('better-sqlite3/package.json', { paths: [DESKTOP_ROOT] }),
);
const RELEASE_DIR = join(BSQLITE_ROOT, 'build', 'Release');
const ACTIVE_PATH = join(RELEASE_DIR, 'better_sqlite3.node');
const NODE_BINDING = join(RELEASE_DIR, 'node-abi.node');

/** Comprueba de verdad (proceso hijo) si el `.node` en `path` carga bajo Node. */
function loadsUnderNode(path) {
  try {
    execFileSync(process.execPath, ['-e', `require(${JSON.stringify(path)})`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (existsSync(NODE_BINDING)) {
  copyFileSync(NODE_BINDING, ACTIVE_PATH);
  console.log('[rebuild-native-for-node] listo. better-sqlite3 vuelve a cargar el binding de Node.');
  process.exit(0);
}

// No hay backup guardado. No basta con que build/Release/better_sqlite3.node
// exista para asumir que no hay nada que hacer — puede ser el binding de
// Electron de una corrida de rebuild:native:electron que no llegó a guardar
// el de Node (ver ese script para el porqué). Se verifica cargándolo de
// verdad bajo Node antes de decidir.
if (existsSync(ACTIVE_PATH) && loadsUnderNode(ACTIVE_PATH)) {
  console.log('[rebuild-native-for-node] nada que restaurar, ya está activo el binding de Node.');
  process.exit(0);
}

console.error(
  '[rebuild-native-for-node] FALLO: no hay ningún binding de Node guardado ni activo. ' +
    'Corre "pnpm install" (o borra build/Release/ y vuelve a instalar) para regenerar ' +
    'build/Release/better_sqlite3.node desde cero.',
);
process.exit(1);
