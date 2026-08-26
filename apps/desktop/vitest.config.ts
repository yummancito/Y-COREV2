// vitest.config.ts
// Para qué sirve: el main process corre en Node (DB, spawn, fs) y el renderer
// en un DOM (React) — un único environment para todo el paquete forzaría
// jsdom sobre los tests de main (que no lo necesitan y sería más lento) o
// forzaría node sobre los de renderer (que rompería). `test.projects`
// (reemplazo de `environmentMatchGlobs`, removido en Vitest 4) separa los
// dos sin duplicar la config de vitest en dos archivos ni dos comandos.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'main',
          environment: 'node',
          include: ['src/main/**/*.test.ts', 'src/preload/**/*.test.ts'],
          // Varios tests de main/features/downloads levantan un servidor HTTP
          // real y escriben a SQLite real; bajo la carga de correr los ~50
          // archivos de este proyecto en paralelo (contención real de CPU/
          // I/O, no un bug de los tests) el timeout default de 5 s no siempre
          // alcanza, aunque en aislado terminen en milisegundos.
          testTimeout: 20000,
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/renderer/test-setup.ts'],
        },
      },
    ],
  },
});
