import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'electron-vite';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Test de integración de build (ADR-0006, punto 5.2): ejecuta un `electron-vite
 * build` real (vía su API programática, en vez de spawnear un subproceso —
 * más portable entre plataformas y evita depender de cómo pnpm resuelve los
 * binarios `.bin` en Windows) y verifica el artefacto, no la intención. Es el
 * único test capaz de detectar que el `define` de `electron.vite.config.ts`
 * dejó de estar sincronizado con lo que `update-scheduler.ts` lee — un
 * desajuste de config no se ve en ningún test unitario porque ninguno
 * ejecuta el build de verdad.
 *
 * Más lento que el resto de la suite (segundos, no milisegundos): compila los
 * tres bundles reales en cada `it`.
 */

const DESKTOP_ROOT = resolve(__dirname, '../../..');
const MAIN_BUNDLE = resolve(DESKTOP_ROOT, 'out/main/index.js');
const PRELOAD_BUNDLE = resolve(DESKTOP_ROOT, 'out/preload/index.js');
const RENDERER_DIR = resolve(DESKTOP_ROOT, 'out/renderer');
const VITE_CONFIG_PATH = resolve(DESKTOP_ROOT, 'electron.vite.config.ts');

const MARKER_WORKER_URL = 'https://update-scheduler-test-marker.invalid';
const MARKER_CLIENT_SECRET = 'update-scheduler-test-marker-secret';
const MARKER_PUBLIC_KEYS = 'update-scheduler-test-marker-pubkey';
const UPDATE_ENV_KEYS = ['YCORE_WORKER_URL', 'YCORE_CLIENT_SECRET', 'YCORE_MANIFEST_PUBLIC_KEYS', 'YCORE_REQUIRE_UPDATE_CONFIG'] as const;

/** electron.vite.config.ts lee `process.env` en su factory: variar el entorno del proceso de test entre `it`s controla su `define`. */
async function runBuild(env: Partial<Record<(typeof UPDATE_ENV_KEYS)[number], string>>): Promise<void> {
  const previous: Record<string, string | undefined> = {};
  for (const key of UPDATE_ENV_KEYS) {
    previous[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }

  rmSync(resolve(DESKTOP_ROOT, 'out'), { recursive: true, force: true });
  try {
    await build({ configFile: VITE_CONFIG_PATH, logLevel: 'silent' });
  } finally {
    for (const key of UPDATE_ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function readAllRendererAssets(): string {
  const assetsDir = resolve(RENDERER_DIR, 'assets');
  if (!existsSync(assetsDir)) return '';
  return readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(resolve(assetsDir, name), 'utf8'))
    .join('\n');
}

describe('config de updates embebida en build (ADR-0006)', () => {
  afterEach(() => {
    rmSync(resolve(DESKTOP_ROOT, 'out'), { recursive: true, force: true });
  });

  it('con las tres variables presentes, out/main/index.js las contiene, y preload/renderer no', async () => {
    await runBuild({
      YCORE_WORKER_URL: MARKER_WORKER_URL,
      YCORE_CLIENT_SECRET: MARKER_CLIENT_SECRET,
      YCORE_MANIFEST_PUBLIC_KEYS: MARKER_PUBLIC_KEYS,
    });

    const mainBundle = readFileSync(MAIN_BUNDLE, 'utf8');
    expect(mainBundle).toContain(MARKER_WORKER_URL);
    expect(mainBundle).toContain(MARKER_CLIENT_SECRET);
    expect(mainBundle).toContain(MARKER_PUBLIC_KEYS);

    const preloadBundle = readFileSync(PRELOAD_BUNDLE, 'utf8');
    expect(preloadBundle).not.toContain(MARKER_CLIENT_SECRET);
    expect(preloadBundle).not.toContain(MARKER_PUBLIC_KEYS);

    const rendererAssets = readAllRendererAssets();
    expect(rendererAssets).not.toContain(MARKER_CLIENT_SECRET);
    expect(rendererAssets).not.toContain(MARKER_PUBLIC_KEYS);
  }, 60000);

  it('sin las variables, out/main/index.js no las contiene (modo inerte)', async () => {
    await runBuild({});

    const mainBundle = readFileSync(MAIN_BUNDLE, 'utf8');
    expect(mainBundle).not.toContain(MARKER_WORKER_URL);
    expect(mainBundle).not.toContain(MARKER_CLIENT_SECRET);
    expect(mainBundle).not.toContain(MARKER_PUBLIC_KEYS);
  }, 60000);

  it('con YCORE_REQUIRE_UPDATE_CONFIG=1 y config incompleta, el build falla', async () => {
    await expect(runBuild({ YCORE_REQUIRE_UPDATE_CONFIG: '1' })).rejects.toThrow();
  }, 60000);
});
