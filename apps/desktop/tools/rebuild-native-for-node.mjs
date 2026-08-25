#!/usr/bin/env node
/**
 * rebuild-native-for-node — vuelve a activar el binding de better-sqlite3
 * compilado para Node normal, tras haber usado `rebuild:native:electron`.
 *
 * Sirve porque los tests (`pnpm test`, vía Vitest bajo Node) necesitan el
 * binding de Node, no el de Electron — ver rebuild-native-for-electron.mjs
 * para la explicación completa de por qué no pueden coexistir en el mismo
 * `prebuilds/win32-x64.node`.
 *
 * Uso: pnpm --filter @ycore/desktop rebuild:native:node
 */

import { existsSync, copyFileSync } from 'node:fs';
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

if (!existsSync(NODE_BINDING)) {
  // No es un error: significa que nunca se corrió rebuild:native:electron en
  // esta instalación, así que prebuilds/win32-x64.node ya es el de Node
  // (el que trae pnpm install de fábrica) — no hay nada que restaurar.
  console.log('[rebuild-native-for-node] nada que restaurar, ya está activo el binding de Node.');
  process.exit(0);
}

copyFileSync(NODE_BINDING, ACTIVE_PATH);
console.log('[rebuild-native-for-node] listo. better-sqlite3 vuelve a cargar el binding de Node.');
