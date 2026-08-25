/**
 * `contract` — el mapa único de todos los canales IPC de Y-CORE (ADR-0002).
 *
 * Sirve como la única fuente de verdad que main, preload y renderer comparten:
 * el router valida contra esto, el generador del preload construye los métodos
 * del cliente tipado desde esto, y `docs/02-features/<x>/ipc-channels.md` se
 * genera desde las `.describe()` de esto. Nada de lo anterior se escribe a mano
 * dos veces.
 *
 * Cada feature añade su propio archivo en `src/channels/<feature>.ts` y lo suma
 * aquí. Un canal que cruza features (p. ej. `library` importando algo de
 * `downloads`) es una señal de que esa lógica debería subir a
 * `packages/core-domain`, no de que el contrato necesite un canal compartido.
 */

import { appChannels } from './channels/app.js';
import { libraryChannels } from './channels/library.js';
import { assertContractIsFullyDescribed } from './assert-described.js';

/** Todos los canales del contrato, namespaced por feature (`<feature>.<verbo>`). */
export const contract = {
  ...appChannels,
  ...libraryChannels,
} as const;

assertContractIsFullyDescribed(contract);

/** Nombre de canal válido: unión literal de todas las claves del contrato. */
export type ChannelName = keyof typeof contract;

export {
  defineChannel,
  type ChannelDefinition,
  type ChannelInput,
  type ChannelOutput,
  type DescribedSchema,
} from './channel.js';
