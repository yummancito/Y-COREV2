/**
 * `buildBridge` — construye `window.ycore` como un árbol anidado por namespace.
 *
 * Sirve para que cada canal `<feature>.<verbo>` del contrato se llame desde el
 * renderer como `window.ycore.<feature>.<verbo>(input)` (p. ej.
 * `window.ycore.library.launch({ appId })`, tal como fija ADR-0002 y la skill
 * `nuevo-canal-ipc`), en vez de un objeto plano con claves `"library.launch"`.
 *
 * Separado de `index.ts` para poder testear la forma del árbol sin importar
 * `electron` — este módulo no toca `contextBridge` ni `ipcRenderer`, solo recibe
 * una función `invoke` genérica y arma el objeto alrededor de ella.
 */

import type { contract, ChannelInput, ChannelName } from '@ycore/ipc-contract';
import type { AppError } from '@ycore/result/app-error';
import type { Result } from '@ycore/result';

/** Función que de verdad cruza al main process. La inyecta `index.ts`. */
export type InvokeChannel = <C extends ChannelName>(
  channel: C,
  payload: ChannelInput<(typeof contract)[C]>,
) => Promise<Result<unknown, AppError>>;

/**
 * Árbol de namespaces construido a partir de los nombres de canal
 * (`"app.ping"` → `{ app: { ping: fn } }`). Los tipos exactos de cada método
 * se afinan con {@link YcoreBridgeFrom} en `index.ts`; aquí solo se construye
 * la forma en runtime.
 */
export type BridgeTree = { [namespace: string]: { [verb: string]: unknown } };

/**
 * Construye el árbol `window.ycore` a partir de las claves del contrato.
 *
 * @param channelNames - Todos los `ChannelName` declarados en el contrato.
 * @param invoke - Función que manda `{ channel, payload }` al main process.
 * @returns Un objeto `{ <namespace>: { <verbo>: (input) => Promise<Result> } }`.
 * @throws Nunca — un nombre de canal mal formado (sin punto) es un error de
 *   programación en `packages/ipc-contract`, no algo que se pueda dar en
 *   producción; se detecta en el test de este módulo, no aquí.
 */
export function buildBridge(channelNames: readonly ChannelName[], invoke: InvokeChannel): BridgeTree {
  const tree: BridgeTree = {};

  for (const channel of channelNames) {
    const [namespace, verb] = channel.split('.', 2) as [string, string];
    tree[namespace] ??= {};
    tree[namespace][verb] = (payload: unknown) => invoke(channel, payload as never);
  }

  return tree;
}
