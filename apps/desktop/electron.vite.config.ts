// electron.vite.config.ts
// Para qué sirve: un único config para los tres bundles de la app (main, preload,
// renderer), con HMR en los tres. Reemplaza los "3 tsconfig sueltos y vite-plugin-electron"
// que el roadmap marca como deuda del v1 (docs/00-overview/roadmap.md, sección G).

import { resolve } from 'node:path';
import { cpSync } from 'node:fs';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * Copia `src/main/db/migrations` a `out/main/db/migrations` después de cada
 * build del proceso main. Sirve porque las migraciones son `.sql`/`.json`, no
 * código: Vite no las empaqueta, y `main/bootstrap/database.ts` las busca vía
 * `join(__dirname, '../db/migrations')` relativo al `out/main` de producción.
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

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyMigrationsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
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
