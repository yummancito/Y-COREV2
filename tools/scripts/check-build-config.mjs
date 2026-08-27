#!/usr/bin/env node
/**
 * check-build-config — verifica que la config de updates embebida en build
 * (ADR-0006) siga sincronizada con lo que el código realmente lee.
 *
 * Comprueba, sobre `apps/desktop/electron.vite.config.ts` y
 * `apps/desktop/src/main/bootstrap/update-scheduler.ts`:
 *   1. El conjunto de claves `YCORE_*` que `update-scheduler.ts` lee de
 *      `process.env` es exactamente el conjunto que aparece en el `define`
 *      de la sección `main`. Es el checker que impide repetir el bug que
 *      motivó el ADR-0006: una variable nueva en el código que nadie añade
 *      al build sale siempre inerte, en silencio.
 *   2. El `define` vive solo en la sección `main`, nunca en `preload` ni en
 *      `renderer` — el secreto del HMAC no debe llegar al proceso que
 *      renderiza contenido.
 *   3. El config no contiene literales de producción hardcodeados (hosts
 *      `workers.dev`/`y-core.app`, o cadenas base64 largas que parecen una
 *      clave real): un fallback "temporal" a producción no debe poder
 *      commitearse.
 *   4. Existe `apps/desktop/.env.example` con las tres claves.
 *
 * Uso:  pnpm check:build-config
 * Salida: exit 0 = ok · exit 1 = desajuste, define fuera de main, o literal
 *   de producción encontrado.
 *
 * Solo Node puro: se ejecuta en CI y en el hook de pre-commit.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const DESKTOP_ROOT = join(REPO_ROOT, 'apps', 'desktop');
const VITE_CONFIG_PATH = join(DESKTOP_ROOT, 'electron.vite.config.ts');
const SCHEDULER_PATH = join(DESKTOP_ROOT, 'src', 'main', 'bootstrap', 'update-scheduler.ts');
const ENV_EXAMPLE_PATH = join(DESKTOP_ROOT, '.env.example');

if (!existsSync(VITE_CONFIG_PATH) || !existsSync(SCHEDULER_PATH)) {
  console.log('OK: check:build-config — apps/desktop no existe todavía, nada que verificar.');
  process.exit(0);
}

const viteConfig = readFileSync(VITE_CONFIG_PATH, 'utf8');
const scheduler = readFileSync(SCHEDULER_PATH, 'utf8');

const problems = [];

/** Claves YCORE_* que update-scheduler.ts lee de process.env (notación de punto, ver ADR-0006). */
const readKeys = new Set([...scheduler.matchAll(/process\.env\.(YCORE_[A-Z_]+)/g)].map((m) => m[1]));

/** Claves YCORE_* presentes en algún `define` del config de electron-vite. */
const definedKeys = new Set([...viteConfig.matchAll(/['"]process\.env\.(YCORE_[A-Z_]+)['"]/g)].map((m) => m[1]));

const missingFromDefine = [...readKeys].filter((k) => !definedKeys.has(k));
const extraInDefine = [...definedKeys].filter((k) => !readKeys.has(k));

if (missingFromDefine.length > 0) {
  problems.push(
    `update-scheduler.ts lee ${missingFromDefine.join(', ')} pero no aparece en ningún ` +
      `\`define\` de electron.vite.config.ts — ese build sale siempre inerte para esa clave (ADR-0006).`,
  );
}
if (extraInDefine.length > 0) {
  problems.push(
    `electron.vite.config.ts define ${extraInDefine.join(', ')} pero update-scheduler.ts no lo lee — ` +
      `define huérfano, revisar si sigue haciendo falta.`,
  );
}

/**
 * El identificador que agrupa el define de updates (p. ej. `UPDATE_CONFIG_DEFINE`)
 * debe usarse como `define:` únicamente dentro del bloque `main: { ... }` —
 * nunca en `preload:` ni `renderer:` (ADR-0006, punto 1: el secreto del HMAC
 * no debe llegar al proceso que renderiza contenido).
 */
const defineIdentifierMatch = viteConfig.match(/define:\s*(\w+)\s*,?\s*\n[\s\S]*?build:\s*\{[\s\S]*?input:\s*resolve\(__dirname,\s*'src\/main/);
const defineIdentifier = defineIdentifierMatch?.[1] ?? null;

if (definedKeys.size > 0) {
  if (defineIdentifier === null) {
    problems.push('no se encontró `define:` en la sección `main` de electron.vite.config.ts (ADR-0006, punto 1).');
  } else {
    const usageCount = [...viteConfig.matchAll(new RegExp(`define:\\s*${defineIdentifier}\\b`, 'g'))].length;
    if (usageCount > 1) {
      problems.push(
        `\`${defineIdentifier}\` se usa como \`define:\` más de una vez — debe aparecer únicamente en ` +
          `la sección \`main\`, nunca en \`preload\` ni \`renderer\` (ADR-0006, punto 1).`,
      );
    }
  }
}

const PRODUCTION_HOST_PATTERN = /workers\.dev|y-core\.app/;
const LONG_BASE64_LITERAL_PATTERN = /['"][A-Za-z0-9+/]{32,}={0,2}['"]/;

if (PRODUCTION_HOST_PATTERN.test(viteConfig)) {
  problems.push('electron.vite.config.ts contiene un host de producción hardcodeado (workers.dev / y-core.app).');
}
if (LONG_BASE64_LITERAL_PATTERN.test(viteConfig)) {
  problems.push('electron.vite.config.ts contiene una cadena base64 larga — parece una clave o secreto hardcodeado.');
}

if (!existsSync(ENV_EXAMPLE_PATH)) {
  problems.push('falta apps/desktop/.env.example con las claves YCORE_* documentadas (ADR-0006).');
} else {
  const envExample = readFileSync(ENV_EXAMPLE_PATH, 'utf8');
  const missingFromExample = [...readKeys].filter((k) => !envExample.includes(k));
  if (missingFromExample.length > 0) {
    problems.push(`.env.example no documenta ${missingFromExample.join(', ')}.`);
  }
}

if (problems.length > 0) {
  console.error('FALLO: check:build-config no pasó:\n');
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}

console.log('OK: check:build-config — config de updates sincronizada entre el código y el build (ADR-0006).');
process.exit(0);
