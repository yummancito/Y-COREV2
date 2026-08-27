#!/usr/bin/env node
/**
 * rebuild-native-for-electron — recompila better-sqlite3 contra la ABI de
 * Electron, para poder ejecutar la app real (`pnpm dev` / `pnpm build`).
 *
 * Sirve porque better-sqlite3 solo puede tener un binding nativo activo a la
 * vez: `lib/database.js` siempre carga `build/Release/better_sqlite3.node`
 * vía el paquete `bindings`. Ese binario viene compilado contra la ABI de
 * Node normal — funciona para los tests (`pnpm test`, que corren bajo Node
 * vía Vitest) pero NO para el proceso real de Electron (ABI de V8/Node
 * distinta), donde `new Database(...)` puede reventar el proceso sin ningún
 * error de JS capturable (crash nativo silencioso — ver aprendizaje.md).
 *
 * Este script guarda el binding de Node como `build/Release/node-abi.node` y
 * el de Electron como `build/Release/electron-abi.node`, e intercambia cuál
 * de los dos está activo en `build/Release/better_sqlite3.node` — así el
 * paquete nunca queda sin binding para ninguno de los dos contextos y ambos
 * quedan disponibles tras el primer `pnpm rebuild:native:electron`.
 *
 * Requiere Visual Studio Build Tools (workload C++) instalado y accesible —
 * en Windows, correr este script desde una "Developer Command Prompt for VS
 * 2022" o con `vcvars64.bat` cargado. Sin eso, `node-gyp` no encuentra
 * `cl.exe`/`link.exe` y el rebuild "termina" sin compilar nada (ver
 * aprendizaje.md para el diagnóstico completo de este fallo silencioso).
 *
 * Uso:  pnpm --filter @ycore/desktop rebuild:native:electron
 *       pnpm --filter @ycore/desktop rebuild:native:node   (para volver)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, copyFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const DESKTOP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);

/** Resuelve la carpeta real de better-sqlite3 sin importar la versión instalada. */
function resolveBsqliteRoot() {
  const pkgJsonPath = require.resolve('better-sqlite3/package.json', { paths: [DESKTOP_ROOT] });
  return dirname(pkgJsonPath);
}

const BSQLITE_ROOT = resolveBsqliteRoot();
const RELEASE_DIR = join(BSQLITE_ROOT, 'build', 'Release');
const ACTIVE_PATH = join(RELEASE_DIR, 'better_sqlite3.node');
const NODE_BINDING = join(RELEASE_DIR, 'node-abi.node');
const ELECTRON_BINDING = join(RELEASE_DIR, 'electron-abi.node');

function log(message) {
  console.log(`[rebuild-native-for-electron] ${message}`);
}

// Primera vez que corre este script: separa el binding original de Node a su
// propio archivo con nombre estable, para no perderlo nunca.
if (existsSync(ACTIVE_PATH) && !existsSync(NODE_BINDING)) {
  log('guardando el binding original de Node como node-abi.node...');
  copyFileSync(ACTIVE_PATH, NODE_BINDING);
}

// Si ya había un binding de Electron guardado de una corrida anterior, lo
// reutiliza en vez de recompilar — más rápido y evita el riesgo de que
// node-gyp "termine" sin compilar nada si vcvars64.bat no está cargado.
if (existsSync(ELECTRON_BINDING)) {
  copyFileSync(ELECTRON_BINDING, ACTIVE_PATH);
  log('listo (reusando binding de Electron ya compilado). Para forzar una recompilación, ' +
    'borra ' + ELECTRON_BINDING + ' primero.');
  process.exit(0);
}

rmSync(join(BSQLITE_ROOT, 'build'), { recursive: true, force: true });

log('corriendo electron-rebuild --build-from-source (puede tardar 1-2 min)...');
execFileSync(
  'pnpm',
  ['exec', 'electron-rebuild', '-f', '-w', 'better-sqlite3', '--build-from-source'],
  { cwd: DESKTOP_ROOT, stdio: 'inherit', shell: true },
);

if (!existsSync(ACTIVE_PATH)) {
  // Recupera el binding de Node antes de fallar: nunca dejar el paquete sin
  // ningún binding activo, ni siquiera en el camino de error.
  if (existsSync(NODE_BINDING)) copyFileSync(NODE_BINDING, ACTIVE_PATH);
  console.error(
    '[rebuild-native-for-electron] FALLO: no se generó build/Release/better_sqlite3.node. ' +
      'Confirma que Visual Studio Build Tools (workload C++) esté instalado y que este ' +
      'script corra desde un entorno con vcvars64.bat cargado (Developer Command Prompt).',
  );
  process.exit(1);
}

copyFileSync(ACTIVE_PATH, ELECTRON_BINDING);

log('listo. better-sqlite3 ahora carga el binding de Electron. Para volver a Node, ' +
  'usa: pnpm --filter @ycore/desktop rebuild:native:node');
