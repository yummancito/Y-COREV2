/**
 * Helper de tests: aplica las migraciones D1 reales contra `env.DB` de
 * Miniflare. `env` y `applyD1Migrations` solo se resuelven en archivos
 * corridos por el pool de `cloudflareTest` (ver `vitest.config.ts` y
 * `aprendizaje.md`), así que este archivo se importa únicamente desde
 * archivos `*.test.ts`.
 */

import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test';

export async function applyMigrations(): Promise<void> {
  const testEnv = env as typeof env & { TEST_MIGRATIONS: string };
  const migrations = JSON.parse(testEnv.TEST_MIGRATIONS) as D1Migration[];
  await applyD1Migrations(env.DB, migrations);
}
