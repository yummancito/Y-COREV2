#!/usr/bin/env node
/**
 * check-docs — garantiza que toda feature del código tiene su documentación.
 *
 * Recorre las features verticales de main y renderer y verifica que cada una
 * tenga `docs/02-features/<feature>/README.md` con contenido real (no una
 * plantilla vacía). Es la pieza que hace que "cada función nueva queda
 * documentada" sea una garantía y no una intención.
 *
 * También recorre `services/*` y exige `docs/03-services/<servicio>/README.md`
 * con el mismo criterio (ADR-0005, checker nº 5).
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
const SERVICES_DIR = join(REPO_ROOT, 'services');
const DOCS_SERVICES = join(REPO_ROOT, 'docs', '03-services');
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

/** Verifica un README.md esperado y añade a `problems` cualquier incumplimiento. */
function checkReadme(readmePath, displayPath, problems) {
  if (!existsSync(readmePath)) {
    problems.push(`falta ${displayPath} (existe en el código pero no está documentado)`);
    return;
  }

  const content = readFileSync(readmePath, 'utf8').trim();
  if (content.length < MIN_README_CHARS) {
    problems.push(
      `${displayPath} está casi vacío (${content.length} caracteres, mínimo ${MIN_README_CHARS}). ` +
        `Descríbelo de verdad.`,
    );
  }
  if (content.includes('TODO') || content.includes('<!-- rellenar -->')) {
    problems.push(`${displayPath} todavía tiene marcadores TODO sin rellenar.`);
  }
}

const problems = [];

for (const feature of collectFeatures()) {
  checkReadme(join(DOCS_FEATURES, feature, 'README.md'), `docs/02-features/${feature}/README.md`, problems);
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

const services = listDirs(SERVICES_DIR);
for (const service of services) {
  checkReadme(join(DOCS_SERVICES, service, 'README.md'), `docs/03-services/${service}/README.md`, problems);
}

const codeServices = new Set(services);
for (const documented of listDirs(DOCS_SERVICES)) {
  if (!codeServices.has(documented)) {
    problems.push(
      `docs/03-services/${documented}/ documenta un servicio que ya no existe en el código. ` +
        `Bórrala o restaura el servicio.`,
    );
  }
}

if (problems.length > 0) {
  console.error('FALLO: check:docs no pasó:\n');
  for (const p of problems) console.error(`  • ${p}`);
  console.error('\nToda feature necesita su carpeta en docs/02-features/. Ver .claude/CLAUDE.md.');
  process.exit(1);
}

const totalFeatures = collectFeatures().length;
const totalServices = services.length;
console.log(
  `OK: check:docs — ${totalFeatures} feature(s) y ${totalServices} servicio(s) documentado(s) correctamente.`,
);
process.exit(0);
