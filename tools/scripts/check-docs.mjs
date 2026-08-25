#!/usr/bin/env node
/**
 * check-docs — garantiza que toda feature del código tiene su documentación.
 *
 * Recorre las features verticales de main y renderer y verifica que cada una
 * tenga `docs/02-features/<feature>/README.md` con contenido real (no una
 * plantilla vacía). Es la pieza que hace que "cada función nueva queda
 * documentada" sea una garantía y no una intención.
 *
 * Uso:  pnpm check:docs
 * Salida: exit 0 = ok · exit 1 = falta documentación (lista qué falta)
 *
 * Se ejecuta en CI y desde el hook Stop, así que no puede depender de nada
 * que no esté instalado: solo Node puro.
 */

import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const FEATURE_DIRS = [
  'apps/desktop/src/main/features',
  'apps/desktop/src/renderer/features',
];
const DOCS_FEATURES = join(REPO_ROOT, 'docs', '02-features');
const MIN_README_CHARS = 200;

/** Lista los subdirectorios de una ruta, o [] si no existe. */
function listDirs(absPath) {
  if (!existsSync(absPath)) return [];
  return readdirSync(absPath, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/** Recolecta el conjunto único de features presentes en el código. */
function collectFeatures() {
  const features = new Set();
  for (const dir of FEATURE_DIRS) {
    for (const name of listDirs(join(REPO_ROOT, dir))) features.add(name);
  }
  return [...features].sort();
}

const problems = [];

for (const feature of collectFeatures()) {
  const readme = join(DOCS_FEATURES, feature, 'README.md');

  if (!existsSync(readme)) {
    problems.push(
      `falta docs/02-features/${feature}/README.md ` +
        `(la feature existe en el código pero no está documentada)`,
    );
    continue;
  }

  const content = readFileSync(readme, 'utf8').trim();
  if (content.length < MIN_README_CHARS) {
    problems.push(
      `docs/02-features/${feature}/README.md está casi vacío ` +
        `(${content.length} caracteres, mínimo ${MIN_README_CHARS}). Descríbela de verdad.`,
    );
  }
  if (content.includes('TODO') || content.includes('<!-- rellenar -->')) {
    problems.push(
      `docs/02-features/${feature}/README.md todavía tiene marcadores TODO sin rellenar.`,
    );
  }
}

// Documentación huérfana: docs de features que ya no existen en el código.
const codeFeatures = new Set(collectFeatures());
for (const documented of listDirs(DOCS_FEATURES)) {
  if (!codeFeatures.has(documented)) {
    problems.push(
      `docs/02-features/${documented}/ documenta una feature que ya no existe en el código. ` +
        `Bórrala o restaura la feature.`,
    );
  }
}

if (problems.length > 0) {
  console.error('FALLO: check:docs no pasó:\n');
  for (const p of problems) console.error(`  • ${p}`);
  console.error('\nToda feature necesita su carpeta en docs/02-features/. Ver .claude/CLAUDE.md.');
  process.exit(1);
}

const total = collectFeatures().length;
console.log(`OK: check:docs — ${total} feature(s) documentada(s) correctamente.`);
process.exit(0);
