#!/usr/bin/env node
/**
 * check-no-private-key — impide que la clave privada Ed25519 entre en el Worker.
 *
 * Grep de `PRIVATE_KEY`, `BEGIN PRIVATE KEY` y `SIGNING_KEY` bajo
 * `services/` y en `wrangler.jsonc`. La propiedad de seguridad completa del
 * ADR-0005 (punto 5: "comprometer Cloudflare no compromete las
 * actualizaciones") solo vale si un despiste no puede meter la clave privada
 * ahí — la firma se hace siempre en el pipeline de CI, nunca en el Worker.
 *
 * Uso:  pnpm check:no-private-key
 * Salida: exit 0 = ok · exit 1 = se encontró una coincidencia sospechosa (lista dónde)
 *
 * Se ejecuta en CI y en el hook de pre-commit. Solo Node puro.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const SERVICES_DIR = join(REPO_ROOT, 'services');
const WRANGLER_CONFIGS = ['services/update-worker/wrangler.jsonc'];

const FORBIDDEN_PATTERNS = [/PRIVATE_KEY/, /BEGIN PRIVATE KEY/, /SIGNING_KEY/];
const SKIP_DIRS = new Set(['node_modules', '.wrangler', 'dist', 'out']);

/** Recorre un directorio recursivamente y devuelve las rutas de todos los archivos de texto. */
function listFilesRecursive(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const targets = [];
if (statSync(SERVICES_DIR, { throwIfNoEntry: false })) targets.push(...listFilesRecursive(SERVICES_DIR));
for (const relPath of WRANGLER_CONFIGS) {
  const full = join(REPO_ROOT, relPath);
  if (statSync(full, { throwIfNoEntry: false })) targets.push(full);
}

const matches = [];

for (const file of targets) {
  if (file === import.meta.filename) continue;
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      matches.push(`${file} — coincide con ${pattern}`);
      break;
    }
  }
}

if (matches.length > 0) {
  console.error('FALLO: check:no-private-key no pasó — posible clave privada en el Worker:\n');
  for (const m of matches) console.error(`  • ${m}`);
  console.error(
    '\nLa firma Ed25519 se hace SIEMPRE en el pipeline de CI (GitHub Secrets), nunca en el ' +
      'Worker (ADR-0005, punto 5). Si esto es un falso positivo (p. ej. un comentario que ' +
      'menciona la regla), reformúlalo para no contener el literal.',
  );
  process.exit(1);
}

console.log('OK: check:no-private-key — ninguna referencia a claves privadas bajo services/.');
process.exit(0);
