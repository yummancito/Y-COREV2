// rules-de-ipc-y-tipos.js
// Para qué sirve: implementa dos reglas inviolables de .claude/CLAUDE.md que ESLint
// sí puede verificar de forma exhaustiva (a diferencia del checker de hooks, que solo
// ve el archivo que se acaba de escribir):
//   - B.1: "un solo ipcMain.handle", fuera de main/ipc/router.ts es error.
//   - B.6: prohibido `any` explícito — usa `unknown` + Zod para parsear.

/** @type {import('eslint').Linter.RulesRecord} */
export const rulesDeTipos = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
};

/**
 * Construye la regla `no-restricted-syntax` que impide `ipcMain.handle/on` e
 * `ipcRenderer.*` fuera de sus archivos permitidos. Es una función (no una
 * constante) porque el mensaje cambia según si el override es para main o
 * para el resto del árbol.
 */
export function noRawIpcRule() {
  return {
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "CallExpression[callee.object.name='ipcMain'][callee.property.name=/^(handle|handleOnce|on)$/]",
        message:
          'ipcMain.handle/on solo puede existir en apps/desktop/src/main/ipc/router.ts. ' +
          'Declara el canal en packages/ipc-contract (regla B.1 del roadmap).',
      },
      {
        selector:
          "CallExpression[callee.object.name='ipcRenderer'][callee.property.name=/^(invoke|send|on)$/]",
        message:
          'ipcRenderer solo puede usarse en apps/desktop/src/preload/. Desde el renderer ' +
          'usa el cliente tipado generado (window.ycore.<feature>.<método>).',
      },
    ],
  };
}
