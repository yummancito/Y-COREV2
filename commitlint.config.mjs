// commitlint.config.mjs
// Para qué sirve: valida Conventional Commits (regla B.7 del roadmap) y restringe el
// scope a una lista cerrada de packages/apps/features reales, para que "fix(libary): ..."
// (typo) o "fix(random-stuff): ..." no pasen nunca.
//
// Al añadir un package, app o feature nueva hay que sumar su nombre aquí — si no,
// commitlint rechaza el commit con "scope inválido". Es intencional: obliga a que el
// scope del commit siga significando algo real del repo.

const SCOPES_EXISTENTES = [
  // apps
  'desktop',
  'web-landing',
  // packages ya creados
  'result',
  'logger',
  'tsconfig',
  'eslint-config',
  'ipc-contract',
  'core-domain',
  'steam-kit',
  // infraestructura del propio repo (sin código de producto)
  'repo',
  'docs',
  'claude',
];

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', SCOPES_EXISTENTES],
    'scope-empty': [2, 'never'],
  },
};
