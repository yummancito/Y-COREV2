// drizzle.config.ts
// Para qué sirve: le dice a drizzle-kit dónde está el esquema y dónde generar
// las migraciones (pnpm --filter @ycore/desktop db:generate). No se usa en
// runtime — solo en desarrollo, al cambiar schema.ts.

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/db/schema.ts',
  out: './src/main/db/migrations',
});
