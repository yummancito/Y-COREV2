// eslint.config.mjs — services/update-worker
// Para qué sirve: aplica la config compartida @ycore/eslint-config, más la
// regla local que prohíbe módulos node:* — el runtime es workerd, no Node
// (ADR-0005, punto 3: "el runtime NO es Node").
import ycoreConfig from '@ycore/eslint-config';

export default [
  ...ycoreConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message:
                'services/update-worker corre en workerd, no en Node — un import de node:* ' +
                'compila pero revienta en producción (ADR-0005, punto 3).',
            },
          ],
        },
      ],
    },
  },
];
