#!/usr/bin/env node
/**
 * check-file-rules — hook PostToolUse (Write|Edit).
 *
 * Valida el archivo que Claude acaba de escribir contra las reglas inviolables
 * de `.claude/CLAUDE.md`. Si alguna se rompe, devuelve exit 2 con el motivo en
 * stderr, lo que hace que el harness BLOQUEE y le explique el error a Claude.
 *
 * Entrada: JSON del hook por stdin ({ tool_input: { file_path, ... } }).
 * Salida:  exit 0 = ok · exit 2 = bloqueado (stderr = motivo).
 *
 * Reglas verificadas aquí (las que se pueden ver en un solo archivo):
 *   R1 — máximo 400 líneas por archivo
 *   R2 — nada de `.md` nuevos en la raíz salvo la allowlist
 *   R3 — `ipcMain.handle` solo en main/ipc/router.ts
 *   R4 — el preload no expone un invoke() genérico
 *   R5 — prohibido `any` explícito
 *   R6 — `eslint-disable` exige `// JUSTIFICACIÓN:`
 *   R7 — scripts sueltos en la raíz
 */

import { readFileSync, existsSync } from 'node:fs';
import { relative, basename, sep, dirname, resolve } from 'node:path';

const MAX_LINES = 400;
const ROOT_MD_ALLOWLIST = new Set([
  'README.md', 'CONTRIBUTING.md', 'LICENSE.md', 'SECURITY.md', 'CHANGELOG.md',
  // aprendizaje.md es el único documento vivo permitido en raíz (regla yumman agency):
  // registro de errores resueltos, no un informe de auditoría puntual.
  'aprendizaje.md',
]);

/**
 * Localiza la raíz del repo subiendo hasta encontrar `.git`.
 *
 * No sirve `process.cwd()`: el hook se ejecuta con el cwd de la sesión, que no
 * tiene por qué ser la raíz del repo. Usarlo hacía que `relative()` devolviera
 * rutas con `..` y el checker se saltara todas las reglas en silencio.
 */
function findRepoRoot(startPath) {
  let dir = resolve(startPath);
  for (;;) {
    if (existsSync(resolve(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Lee el payload JSON que el harness manda por stdin. */
function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

/** Normaliza a ruta relativa con separadores POSIX para poder hacer match estable. */
function toPosixRelative(repoRoot, absPath) {
  return relative(repoRoot, absPath).split(sep).join('/');
}

/**
 * Aplica todas las reglas a un archivo.
 * @returns {string[]} lista de violaciones (vacía = todo bien)
 */
function checkFile(absPath) {
  if (!existsSync(absPath)) return [];

  // La raíz se busca desde el archivo, no desde el cwd del proceso.
  const repoRoot = findRepoRoot(dirname(absPath));
  if (repoRoot === null) return [];

  const rel = toPosixRelative(repoRoot, absPath);
  // Fuera del repo (p. ej. el scratchpad): no aplican nuestras reglas.
  if (rel.startsWith('..')) return [];

  const name = basename(rel);
  const isRoot = !rel.includes('/');
  const violations = [];

  // R2 — .md en la raíz
  if (isRoot && name.endsWith('.md') && !ROOT_MD_ALLOWLIST.has(name)) {
    violations.push(
      `R2: prohibido crear "${name}" en la raíz. Toda documentación va a docs/. ` +
        `Solo se permiten en raíz: ${[...ROOT_MD_ALLOWLIST].join(', ')}.`,
    );
  }

  // R7 — scripts sueltos en la raíz. Excepción: archivos de configuración que su propia
  // herramienta exige encontrar en la raíz del repo (eslint.config.*, commitlint.config.*).
  // No son "scripts sueltos": son config declarativa, sin lógica de negocio.
  const CONFIG_DE_HERRAMIENTA_EN_RAIZ = /^(eslint\.config|commitlint\.config)\./;
  if (isRoot && /\.(c|m)?[jt]s$/.test(name) && !CONFIG_DE_HERRAMIENTA_EN_RAIZ.test(name)) {
    violations.push(
      `R7: prohibido crear scripts sueltos en la raíz ("${name}"). ` +
        `Van a tools/scripts/ en TypeScript y con header de documentación.`,
    );
  }

  // A partir de aquí solo miramos código/texto.
  if (!/\.(c|m)?[jt]sx?$/.test(name) && !name.endsWith('.md')) return violations;

  // Meta-código que menciona ipcMain.handle / ipcRenderer / eslint-disable / any como
  // texto literal para poder detectarlos en OTROS archivos (este propio checker y la
  // config de ESLint que implementa la misma regla) — no se les puede aplicar R3/R3b/R5/R6
  // a sí mismos o se autobloquean con falsos positivos.
  const esMetaCodigoDeReglas =
    rel === 'tools/scripts/check-file-rules.mjs' || rel.startsWith('packages/eslint-config/');
  if (esMetaCodigoDeReglas) return violations;

  const content = readFileSync(absPath, 'utf8');
  const lines = content.split('\n');

  // R1 — tamaño (no aplica a markdown ni a archivos generados)
  const isGenerated = content.slice(0, 500).includes('@generated');
  if (!name.endsWith('.md') && !isGenerated && lines.length > MAX_LINES) {
    violations.push(
      `R1: ${lines.length} líneas supera el máximo de ${MAX_LINES}. ` +
        `Divide este archivo en módulos más pequeños antes de continuar.`,
    );
  }

  if (name.endsWith('.md')) return violations;

  // R3 — ipcMain.handle fuera del router
  const isRouter = rel.endsWith('apps/desktop/src/main/ipc/router.ts');
  if (!isRouter && /ipcMain\s*\.\s*(handle|handleOnce|on)\b/.test(content)) {
    violations.push(
      `R3: "ipcMain.handle/on" solo puede existir en apps/desktop/src/main/ipc/router.ts. ` +
        `Declara el canal en packages/ipc-contract y regístralo en el registry.`,
    );
  }

  // R3b — ipcRenderer fuera del preload
  const isPreload = rel.includes('apps/desktop/src/preload/');
  if (!isPreload && /ipcRenderer\s*\.\s*(invoke|send|on)\b/.test(content)) {
    violations.push(
      `R3b: "ipcRenderer" solo puede usarse en apps/desktop/src/preload/. ` +
        `Desde el renderer usa el cliente tipado (window.ycore.<feature>.<método>).`,
    );
  }

  // R4 — invoke genérico en el preload
  if (isPreload && /invoke\s*:\s*\(\s*channel\b/.test(content)) {
    violations.push(
      `R4: el preload NO puede exponer un invoke(channel, ...) genérico. ` +
        `Ese fue el agujero de seguridad del v1. Genera un método por canal desde el contrato.`,
    );
  }

  // R5 — any explícito
  lines.forEach((line, i) => {
    if (/\bas\s+any\b|:\s*any\b|<any>/.test(line) && !line.includes('eslint-disable')) {
      violations.push(
        `R5: "any" explícito en la línea ${i + 1}. Usa "unknown" + Zod para parsear.`,
      );
    }
  });

  // R6 — eslint-disable sin justificación
  lines.forEach((line, i) => {
    if (!line.includes('eslint-disable')) return;
    const context = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
    if (!context.includes('JUSTIFICACIÓN:')) {
      violations.push(
        `R6: "eslint-disable" en la línea ${i + 1} sin "// JUSTIFICACIÓN: ..." encima. ` +
          `Además debe quedar registrado en docs/exceptions.md.`,
      );
    }
  });

  return violations;
}

const payload = readStdin();
const filePath = payload?.tool_input?.file_path;
if (!filePath) process.exit(0);

const violations = checkFile(filePath);
if (violations.length > 0) {
  console.error(
    `BLOQUEADO: el archivo rompe las reglas de .claude/CLAUDE.md:\n\n` +
      violations.map((v) => `  • ${v}`).join('\n') +
      `\n\nCorrígelo antes de seguir. No desactives la regla.`,
  );
  process.exit(2);
}
process.exit(0);
