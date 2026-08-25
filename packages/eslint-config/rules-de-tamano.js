// rules-de-tamano.js
// Para qué sirve: agrupa las reglas de la sección B.2 de docs/00-overview/roadmap.md —
// "Límite duro de tamaño". 400 líneas/archivo, 60 líneas/función, complejidad 12,
// todo en nivel error. Separado del index.js principal para no acercarse al propio
// límite de 400 líneas que este archivo hace cumplir.

/** @type {import('eslint').Linter.RulesRecord} */
export const rulesDeTamano = {
  'max-lines': [
    'error',
    { max: 400, skipBlankLines: false, skipComments: false },
  ],
  'max-lines-per-function': [
    'error',
    { max: 60, skipBlankLines: false, skipComments: false, IIFEs: true },
  ],
  complexity: ['error', 12],
};
