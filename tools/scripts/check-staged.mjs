#!/usr/bin/env node
/**
 * check-staged — guard de pre-commit.
 *
 * Rechaza commits que metan basura en el repo. Nace de dos cicatrices del v1:
 * un instalador `.exe` de 428 MB commiteado, y ~90 `.md` de auditorías sueltos
 * en la raíz.
 *
 * También corre aquí `check:no-private-key` (ADR-0005, punto 5): la clave privada
 * Ed25519 no puede colarse en `services/` ni en un `wrangler.jsonc` ni en un commit.
 *
 * Uso:  node tools/scripts/check-staged.mjs   (desde el hook pre-commit)
 * Salida: exit 0 = ok · exit 1 = commit rechazado
 */

import { execSync } from 'node:child_process';
import { statSync, existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

const FORBIDDEN_KEY_PATTERNS = [/PRIVATE_KEY/, /BEGIN PRIVATE KEY/, /SIGNING_KEY/];

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ROOT_MD_ALLOWLIST = new Set([
  'README.md', 'CONTRIBUTING.md', 'LICENSE.md', 'SECURITY.md', 'CHANGELOG.md',
  'aprendizaje.md',
]);
const BANNED_EXTENSIONS = new Set(['.exe', '.dll', '.msi', '.zip', '.7z', '.asar']);

/** Devuelve las rutas staged (añadidas/copiadas/modificadas/renombradas). */
function stagedFiles() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    encoding: 'utf8',
  });
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

const problems = [];

for (const file of stagedFiles()) {
  if (!existsSync(file)) continue;

  const size = statSync(file).size;
  if (size > MAX_BYTES) {
    const mb = (size / 1024 / 1024).toFixed(1);
    problems.push(`${file} pesa ${mb} MB (máximo 5 MB). Los binarios no van en git.`);
  }

  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  if (BANNED_EXTENSIONS.has(ext)) {
    problems.push(`${file} tiene extensión ${ext}, prohibida en el repo. Súbelo a R2.`);
  }

  const isRoot = !file.includes('/');
  const name = basename(file);
  if (isRoot && name.endsWith('.md') && !ROOT_MD_ALLOWLIST.has(name)) {
    problems.push(`${file}: los .md van a docs/, no a la raíz.`);
  }

  const isWranglerConfig = file === 'services/update-worker/wrangler.jsonc';
  if (file.startsWith('services/') || isWranglerConfig) {
    const content = readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN_KEY_PATTERNS) {
      if (pattern.test(content)) {
        problems.push(
          `${file}: contiene "${pattern}" — la clave privada Ed25519 se firma SIEMPRE en CI, ` +
            `nunca en el Worker (ADR-0005, punto 5).`,
        );
        break;
      }
    }
  }
}

if (problems.length > 0) {
  console.error('BLOQUEADO: commit rechazado:\n');
  for (const p of problems) console.error(`  • ${p}`);
  console.error('\nVer .claude/CLAUDE.md → reglas inviolables.');
  process.exit(1);
}

process.exit(0);
