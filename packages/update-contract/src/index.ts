/**
 * `@ycore/update-contract` — schemas Zod compartidos por `services/update-worker`
 * y `packages/updater-client` (ADR-0005).
 *
 * Sirve como la única fuente de verdad de la forma de los mensajes entre el
 * Worker y el cliente de actualizaciones: el Worker valida su output contra
 * estos schemas en test, el cliente valida la respuesta real antes de
 * confiar en ella. Sin este paquete, cada lado tendría que definir su propio
 * tipo y acoplarse "por el JSON documentado" — la receta para divergir en la
 * primera prisa (ADR-0005, punto 3.b).
 *
 * Paquete puro: cero I/O, cero dependencias más allá de `zod`. No importa
 * nada de `packages/ipc-contract` (es una frontera distinta: main↔renderer
 * vs. app↔Worker) ni de `packages/core-domain`/`packages/result`.
 */

import { assertSchemaIsDescribed } from './assert-described.js';
import { AdminMaintenanceSchema, AdminReleaseSchema } from './admin.js';
import { CheckRequestSchema, CheckResponseSchema } from './check.js';
import { ManifestSchema } from './manifest.js';

assertSchemaIsDescribed('CheckRequestSchema', CheckRequestSchema);
assertSchemaIsDescribed('CheckResponseSchema', CheckResponseSchema);
assertSchemaIsDescribed('ManifestSchema', ManifestSchema);
assertSchemaIsDescribed('AdminMaintenanceSchema', AdminMaintenanceSchema);
assertSchemaIsDescribed('AdminReleaseSchema', AdminReleaseSchema);

export { CheckRequestSchema, CheckResponseSchema, type CheckRequest, type CheckResponse } from './check.js';
export { ManifestSchema, type Manifest } from './manifest.js';
export {
  AdminMaintenanceSchema,
  AdminReleaseSchema,
  type AdminMaintenanceInput,
  type AdminReleaseInput,
} from './admin.js';
