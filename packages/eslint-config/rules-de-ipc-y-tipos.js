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

const IPC_MAIN_SELECTOR =
  "CallExpression[callee.object.name='ipcMain'][callee.property.name=/^(handle|handleOnce|on)$/]";
const IPC_RENDERER_SELECTOR =
  "CallExpression[callee.object.name='ipcRenderer'][callee.property.name=/^(invoke|send|on)$/]";

/**
 * Dos bloques de config flat (no un objeto de reglas) porque cada uno necesita
 * su propio `ignores`: el router.ts es el ÚNICO archivo permitido a llamar
 * `ipcMain.handle`, así que la regla que se lo prohíbe al resto del árbol no
 * puede aplicarse también a él — un `files`/`ignores` por regla es la única
 * forma de expresar esa excepción en ESLint 9 flat config sin resolverlo con
 * comentarios `eslint-disable` en el propio router (que además violaría la
 * regla R6 de justificación por archivo especial).
 */
export function noRawIpcConfigs() {
  return [
    {
      ignores: ['**/main/ipc/router.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: IPC_MAIN_SELECTOR,
            message:
              'ipcMain.handle/on solo puede existir en apps/desktop/src/main/ipc/router.ts. ' +
              'Declara el canal en packages/ipc-contract (regla B.1 del roadmap).',
          },
        ],
      },
    },
    {
      ignores: ['**/preload/**'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: IPC_RENDERER_SELECTOR,
            message:
              'ipcRenderer solo puede usarse en apps/desktop/src/preload/. Desde el renderer ' +
              'usa el cliente tipado generado (window.ycore.<feature>.<método>).',
          },
        ],
      },
    },
  ];
}
