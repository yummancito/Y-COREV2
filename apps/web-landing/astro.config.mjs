// astro.config.mjs
// Para qué sirve: configura el build estático de la landing "próximamente" de Y-CORE.
// Sin integraciones de framework (React/Vue/etc.) — la landing es HTML+CSS puro,
// tal como fija el roadmap (docs/00-overview/roadmap.md, sección A.1).

import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://y-core.app',
  compressHTML: true,
});
