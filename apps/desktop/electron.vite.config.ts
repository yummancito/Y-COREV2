// electron.vite.config.ts
// Para qué sirve: un único config para los tres bundles de la app (main, preload,
// renderer), con HMR en los tres. Reemplaza los "3 tsconfig sueltos y vite-plugin-electron"
// que el roadmap marca como deuda del v1 (docs/00-overview/roadmap.md, sección G).

import { resolve } from 'node:path';
import { cpSync } from 'node:fs';
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * Copia `src/main/db/migrations` a `out/main/db/migrations` después de cada
 * build del proceso main. Sirve porque las migraciones son `.sql`/`.json`, no
 * código: Vite no las empaqueta, y `main/bootstrap/database.ts` las busca vía
 * `join(__dirname, 'db/migrations')` relativo al `out/main` de producción.
 *
 * `vite-plugin-static-copy` se probó primero pero su hook `writeBundle` no
 * dispara con los "SSR environments" que usa electron-vite en Vite 7 (ver
 * aprendizaje.md) — un `cpSync` directo en `closeBundle` es más simple y no
 * depende de un plugin de terceros para algo tan básico.
 */
function copyMigrationsPlugin() {
  return {
    name: 'ycore-copy-migrations',
    apply: 'build' as const,
    closeBundle(): void {
      cpSync(
        resolve(__dirname, 'src/main/db/migrations'),
        resolve(__dirname, 'out/main/db/migrations'),
        { recursive: true },
      );
    },
  };
}

/**
 * Paquetes del propio workspace: `externalizeDepsPlugin()` los dejaría como
 * `require('@ycore/logger')` externo, pero sus `exports` apuntan directo a
 * `.ts` (para que Vite los transpile al consumirlos) — un `require()` de
 * Node en el bundle final no sabe transpilar TypeScript y revienta con
 * `SyntaxError: Unexpected token 'export'`. Excluidos de la externalización:
 * se bundlean dentro de out/main e out/preload en vez de quedar como
 * dependencia externa.
 */
const WORKSPACE_PACKAGES = [
  '@ycore/core-domain',
  '@ycore/ipc-contract',
  '@ycore/logger',
  '@ycore/result',
  '@ycore/steam-kit',
  '@ycore/update-contract',
  '@ycore/updater-client',
];

/**
 * El preload corre con `sandbox: true` (ver `main/bootstrap/window.ts`), así
 * que su `require()` solo resuelve lo que está bundleado dentro de su propio
 * `out/preload/index.js` — nunca `node_modules` del proyecto. `zod` debe ir
 * excluido de la externalización aquí (main sí tiene `node_modules` completo,
 * así que ahí no hace falta), o el preload falla con
 * `Error: module not found: zod` y `window.ycore` nunca se expone al renderer.
 */
const PRELOAD_EXTRA_BUNDLED = [...WORKSPACE_PACKAGES, 'zod'];

const UPDATE_CONFIG_KEYS = ['YCORE_WORKER_URL', 'YCORE_CLIENT_SECRET', 'YCORE_MANIFEST_PUBLIC_KEYS'] as const;

/**
 * Un build de release (`YCORE_REQUIRE_UPDATE_CONFIG=1`, puesto solo por
 * `release-desktop.yml`) sin las tres variables produce un `.exe` que nunca
 * podrá avisar de que existe un arreglo para sí mismo (ADR-0006, punto 4):
 * un fallo irreversible en campo. Se para el build aquí, no en runtime — el
 * modo inerte de `update-scheduler.ts` sigue intacto para cualquier build
 * que no sea de release. Ningún PR ni `pnpm dev` local necesita este flag.
 */
function assertReleaseConfigComplete(read: (key: string) => string | undefined): void {
  if (process.env['YCORE_REQUIRE_UPDATE_CONFIG'] !== '1') return;
  const missing = UPDATE_CONFIG_KEYS.filter((key) => read(key) === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Build de release sin config de updates: falta ${missing.join(', ')}. ` +
        'Definir estos secrets en el workflow release-desktop.yml (ADR-0006).',
    );
  }
}

/**
 * Config pública de updates (ADR-0006), embebida como literales en
 * `out/main/index.js` en build time. Nunca en `preload` ni `renderer`: el
 * `YCORE_CLIENT_SECRET` no debe llegar al proceso que renderiza contenido.
 *
 * Sale de `process.env` del proceso que ejecuta el build (o de
 * `apps/desktop/.env.local`, cargado aquí sin exigir el prefijo `VITE_` de
 * Vite), no del que ejecuta la app — un `.exe` instalado no hereda el
 * entorno de quien lo compiló. Si falta una variable se sustituye por
 * `undefined` (nunca un fallback a una URL de producción): eso es lo que
 * mantiene el modo inerte de `update-scheduler.ts` como red de seguridad
 * para cualquier build sin esta config, en vez de hardcodear un valor que
 * convertiría cualquier clon del repo en cliente de producción.
 */
function buildUpdateConfigDefine(): Record<string, string> {
  const fileEnv = loadEnv('production', __dirname, '');
  const read = (key: string): string | undefined => process.env[key] ?? fileEnv[key];

  assertReleaseConfigComplete(read);

  return {
    'process.env.YCORE_WORKER_URL': JSON.stringify(read('YCORE_WORKER_URL')),
    'process.env.YCORE_CLIENT_SECRET': JSON.stringify(read('YCORE_CLIENT_SECRET')),
    'process.env.YCORE_MANIFEST_PUBLIC_KEYS': JSON.stringify(read('YCORE_MANIFEST_PUBLIC_KEYS')),
  };
}

const UPDATE_CONFIG_DEFINE = buildUpdateConfigDefine();

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES }), copyMigrationsPlugin()],
    define: UPDATE_CONFIG_DEFINE,
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: PRELOAD_EXTRA_BUNDLED })],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
  },
});
