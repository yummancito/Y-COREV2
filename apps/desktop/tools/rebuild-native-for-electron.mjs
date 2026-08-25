#!/usr/bin/env node
/**
 * rebuild-native-for-electron — recompila better-sqlite3 contra la ABI de
 * Electron, para poder ejecutar la app real (`pnpm dev` / `pnpm build`).
 *
 * Sirve porque better-sqlite3 solo puede tener un binding nativo activo a la
 * vez: `lib/binding.js` siempre prioriza `prebuilds/<plataforma>.node` sobre
 * cualquier build fresco en `build/Release/`. Ese prebuild viene compilado
 * contra la ABI de Node normal — funciona para los tests (`pnpm test`, que
 * corren bajo Node vía Vitest) pero NO para el proceso real de Electron
 * (ABI de V8/Node distinta), donde `new Database(...)` revienta el proceso
 * sin ningún error de JS capturable (crash nativo silencioso).
 *
 * Este script dedica un archivo separado (`prebuilds/win32-x64.electron.node`)
 * para el binding de Electron y lo intercambia con el de Node vía symlink en
 * `prebuilds/win32-x64.node` — así el paquete nunca queda sin binding para
 * ninguno de los dos contextos y ambos quedan disponibles tras el primer
 * `pnpm rebuild:native:electron`.
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

const DESKTOP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BSQLITE_ROOT = join(
  DESKTOP_ROOT,
  '..',
  '..',
  'node_modules',
  '.pnpm',
  'better-sqlite3@13.0.3',
  'node_modules',
  'better-sqlite3',
);
const PREBUILDS_DIR = join(BSQLITE_ROOT, 'prebuilds');
const ACTIVE_PATH = join(PREBUILDS_DIR, 'win32-x64.node');
const NODE_BINDING = join(PREBUILDS_DIR, 'win32-x64.node-abi.node');
const ELECTRON_BINDING = join(PREBUILDS_DIR, 'win32-x64.electron-abi.node');
const BUILD_RELEASE_NODE = join(BSQLITE_ROOT, 'build', 'Release', 'better_sqlite3.node');

function log(message) {
  console.log(`[rebuild-native-for-electron] ${message}`);
}

// Primera vez que corre este script: separa el prebuild original de Node a
// su propio archivo con nombre estable, para no perderlo nunca.
if (existsSync(ACTIVE_PATH) && !existsSync(NODE_BINDING)) {
  log('guardando el prebuild original de Node como win32-x64.node-abi.node...');
  renameSync(ACTIVE_PATH, NODE_BINDING);
}

rmSync(join(BSQLITE_ROOT, 'build'), { recursive: true, force: true });
// Esconder el activo actual para que binding.gyp vea prebuild_exists=0 y
// compile de verdad, sin importar si hoy está activo el de Node o el de
// Electron.
if (existsSync(ACTIVE_PATH)) rmSync(ACTIVE_PATH);

log('corriendo electron-rebuild --build-from-source (puede tardar 1-2 min)...');
execFileSync(
  'pnpm',
  ['exec', 'electron-rebuild', '-f', '-w', 'better-sqlite3', '--build-from-source'],
  { cwd: DESKTOP_ROOT, stdio: 'inherit', shell: true },
);

if (!existsSync(BUILD_RELEASE_NODE)) {
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

copyFileSync(BUILD_RELEASE_NODE, ELECTRON_BINDING);
copyFileSync(ELECTRON_BINDING, ACTIVE_PATH);

log('listo. better-sqlite3 ahora carga el binding de Electron. Para volver a Node, ' +
  'usa: pnpm --filter @ycore/desktop rebuild:native:node');
