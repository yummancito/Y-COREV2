// vitest.config.ts
// Para qué sirve: corre los tests dentro de workerd real (no una emulación
// en Node) vía @cloudflare/vitest-pool-workers, con Miniflare proveyendo KV/
// D1/R2 locales reales — cero cuenta de Cloudflare (ADR-0005, punto 2).
//
// `cloudflareTest(...)` (no `cloudflarePool(...)`) va en `plugins`, no en
// `test.pool`: solo la forma de plugin de Vite registra la resolución del
// módulo virtual `cloudflare:test` que usan los tests de integración para
// leer `env`/`applyD1Migrations` (ver aprendizaje.md). El schema real de
// opciones de esta versión (`WorkersPoolOptionsSchema`, revisado en
// `node_modules`) no tiene ningún campo `isolatedStorage` — el estado de
// KV/D1/R2 persiste entre tests del mismo archivo, así que cada suite debe
// limpiar lo que escribió en su propio `afterEach`/`beforeEach`.
//
// `readD1Migrations` lee del filesystem (Node), así que se llama aquí, no
// dentro del worker — el resultado se inyecta como binding TEST_MIGRATIONS
// (JSON) para que los tests lo apliquen con `applyD1Migrations`.

import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { TEST_MIGRATIONS: JSON.stringify(await readD1Migrations('./migrations')) } },
    })),
  ],
  test: {
    coverage: { provider: 'istanbul' },
  },
});
