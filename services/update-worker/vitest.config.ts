// vitest.config.ts
// Para qué sirve: corre los tests dentro de workerd real (no una emulación
// en Node) vía @cloudflare/vitest-pool-workers, con Miniflare proveyendo KV/
// D1/R2 locales reales — cero cuenta de Cloudflare (ADR-0005, punto 2).
// `isolatedStorage: true` para que cada test arranque con estado limpio.
//
// La API pública de este paquete en la v0.2x (compatible con Vitest 4) ya no
// es `defineWorkersConfig` de un subpath `/config` (esa API documentada en
// varias guías es de versiones anteriores): ahora se configura `test.pool`
// con `cloudflarePool(...)` desde el punto de entrada principal, dentro de
// un `defineConfig` normal de Vitest.

import { defineConfig } from 'vitest/config';
import { cloudflarePool } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  test: {
    pool: cloudflarePool({
      wrangler: { configPath: './wrangler.jsonc' },
      isolatedStorage: true,
    }),
    coverage: { provider: 'istanbul' },
  },
});
