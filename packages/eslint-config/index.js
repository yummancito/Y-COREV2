// index.js — @ycore/eslint-config
// Para qué sirve: config ESLint 9 flat compartida por todo el monorepo. Implementa las
// reglas B.1 a B.4 de docs/00-overview/roadmap.md (IPC, tamaño, boundaries, no-any) para
// que "rompen el build" sea literal y no una intención. Cada paquete/app la importa con:
//
//   import ycoreConfig from '@ycore/eslint-config';
//   export default [...ycoreConfig];

import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';
import { rulesDeTamano } from './rules-de-tamano.js';
import { boundariesSettings, rulesDeBoundaries } from './rules-de-boundaries.js';
import { rulesDeTipos, noRawIpcConfigs } from './rules-de-ipc-y-tipos.js';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.astro/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { boundaries, import: importPlugin },
    settings: boundariesSettings,
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      ...rulesDeTamano,
      ...rulesDeBoundaries,
      ...rulesDeTipos,
    },
  },
  ...noRawIpcConfigs().map((config) => ({ files: ['**/*.{ts,tsx}'], ...config })),
);
