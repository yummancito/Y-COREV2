// eslint.config.mjs — apps/desktop
// Para qué sirve: aplica la config compartida @ycore/eslint-config, que ya trae los
// boundaries de main/preload/renderer y la regla no-raw-ipc — es la app real donde
// esas reglas importan de verdad.
import ycoreConfig from '@ycore/eslint-config';

export default [...ycoreConfig];
