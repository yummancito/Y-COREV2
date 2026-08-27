// rules-de-boundaries.js
// Para qué sirve: implementa la sección B.3 de docs/00-overview/roadmap.md — quién
// importa a quién. Usa eslint-plugin-boundaries porque una regla no-restricted-imports
// a mano no escala: cada feature nueva tendría que repetir sus propias excepciones.
//
// Elementos declarados: cada "tipo" es una carpeta con un patrón glob. boundaries
// deriva de ahí qué archivo pertenece a qué elemento y aplica la matriz de abajo.

/** @type {import('eslint-plugin-boundaries').Options} */
export const boundariesSettings = {
  'boundaries/elements': [
    { type: 'renderer-feature', pattern: 'apps/desktop/src/renderer/features/*/**' },
    { type: 'renderer-shared', pattern: 'apps/desktop/src/renderer/shared/**' },
    { type: 'main-feature', pattern: 'apps/desktop/src/main/features/*/**' },
    { type: 'main-platform', pattern: 'apps/desktop/src/main/platform/**' },
    { type: 'main-db', pattern: 'apps/desktop/src/main/db/**' },
    { type: 'main-ipc', pattern: 'apps/desktop/src/main/ipc/**' },
    { type: 'preload', pattern: 'apps/desktop/src/preload/**' },
    { type: 'core-domain', pattern: 'packages/core-domain/**' },
    { type: 'steam-kit', pattern: 'packages/steam-kit/**' },
    { type: 'ipc-contract', pattern: 'packages/ipc-contract/**' },
    { type: 'ui-kit', pattern: 'packages/ui-kit/**' },
    { type: 'i18n', pattern: 'packages/i18n/**' },
    { type: 'logger', pattern: 'packages/logger/**' },
    { type: 'result', pattern: 'packages/result/**' },
    { type: 'plugin', pattern: 'plugins/*/**' },
    { type: 'update-contract', pattern: 'packages/update-contract/**' },
    { type: 'updater-client', pattern: 'packages/updater-client/**' },
    { type: 'update-worker', pattern: 'services/update-worker/**' },
    { type: 'cli', pattern: 'tools/cli/**' },
  ],
};

/** @type {import('eslint').Linter.RulesRecord} */
export const rulesDeBoundaries = {
  'boundaries/element-types': [
    'error',
    {
      default: 'disallow',
      rules: [
        {
          from: 'renderer-feature',
          allow: ['renderer-shared', 'ipc-contract', 'ui-kit', 'i18n', 'result'],
          message:
            'Una feature del renderer no puede importar de otra feature. Si necesitan ' +
            'compartir lógica, súbela a packages/core-domain (B.3 del roadmap).',
        },
        { from: 'renderer-shared', allow: ['ui-kit', 'i18n', 'result'] },
        {
          from: 'main-feature',
          allow: ['main-platform', 'main-db', 'core-domain', 'steam-kit', 'logger', 'result'],
          message:
            'Una feature del main no puede importar de otra feature. Si necesitan ' +
            'compartir lógica, súbela a packages/core-domain (B.3 del roadmap).',
        },
        { from: 'main-platform', allow: ['logger', 'result'] },
        { from: 'main-db', allow: ['core-domain', 'logger', 'result'] },
        {
          from: 'main-ipc',
          allow: ['main-feature', 'ipc-contract', 'logger', 'result'],
          message: 'El router es el único lugar permitido para orquestar features vía IPC.',
        },
        { from: 'preload', allow: ['ipc-contract'] },
        { from: 'core-domain', allow: ['result'] },
        { from: 'steam-kit', allow: ['core-domain', 'result'] },
        { from: 'plugin', allow: ['ipc-contract', 'core-domain', 'result'] },
        {
          from: 'update-contract',
          allow: [],
          message:
            'packages/update-contract es solo schemas Zod compartidos por el Worker y el ' +
            'cliente de updates — no depende de nada del repo, ni siquiera de result (ADR-0005).',
        },
        { from: 'updater-client', allow: ['update-contract', 'result'] },
        { from: 'update-worker', allow: ['update-contract', 'result'] },
        {
          from: 'cli',
          allow: ['update-contract'],
          message:
            'tools/cli habla HTTP con el Worker (fetch), no importa result ni ningún otro ' +
            'paquete del producto — solo los schemas Zod compartidos para validar payloads.',
        },
      ],
    },
  ],
  'boundaries/no-unknown': 'error',
  'boundaries/no-unknown-files': 'off',
  'import/no-cycle': ['error', { maxDepth: Infinity }],
};
