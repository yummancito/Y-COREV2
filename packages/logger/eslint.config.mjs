// eslint.config.mjs — packages/logger
// Para qué sirve: aplica la config compartida @ycore/eslint-config a este paquete. Cada
// paquete/app tiene el suyo (ESLint 9 no soporta config heredada entre workspaces sin
// esto) pero todos son este mismo re-export de una línea.
import ycoreConfig from '@ycore/eslint-config';

export default [...ycoreConfig];
