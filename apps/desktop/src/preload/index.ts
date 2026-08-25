/**
 * Preload — expone `window.ycore` al renderer, generado desde el contrato.
 *
 * Sirve para que el renderer solo pueda invocar los canales que existen en
 * `packages/ipc-contract`: **no expone `invoke(channel, ...)` genérico** — ese
 * fue el agujero de seguridad del v1 (ADR-0002). Cada canal `<feature>.<verbo>`
 * aparece como `window.ycore.<feature>.<verbo>(input)`; llamar a un canal
 * inexistente es un error de tipos en compilación, no algo intentable en runtime.
 *
 * `contextIsolation: true` + `sandbox: true` (ver `main/bootstrap/window.ts`)
 * hacen que este sea el único código del renderer con acceso a `ipcRenderer`.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { contract, type ChannelInput, type ChannelName, type ChannelOutput } from '@ycore/ipc-contract';
import type { AppError } from '@ycore/result/app-error';
import type { Result } from '@ycore/result';
import { IPC_ENTRY_POINT } from '../main/ipc/router.js';
import { buildBridge, type InvokeChannel } from './build-bridge.js';

const invoke: InvokeChannel = async (channel, payload) =>
  ipcRenderer.invoke(IPC_ENTRY_POINT, { channel, payload }) as Promise<Result<unknown, AppError>>;

/** Namespace deducido de un nombre de canal `"<namespace>.<verbo>"`. */
type NamespaceOf<C extends ChannelName> = C extends `${infer N}.${string}` ? N : never;

/** Verbo deducido de un nombre de canal `"<namespace>.<verbo>"`. */
type VerbOf<C extends ChannelName> = C extends `${string}.${infer V}` ? V : never;

/**
 * Forma tipada de `window.ycore`: un objeto por namespace, con un método por
 * verbo, cada uno tipado según el input/output real de su canal en el contrato.
 */
export type YcoreBridge = {
  [N in NamespaceOf<ChannelName>]: {
    [C in ChannelName as C extends `${N}.${string}` ? VerbOf<C> : never]: (
      input: ChannelInput<(typeof contract)[C]>,
    ) => Promise<Result<ChannelOutput<(typeof contract)[C]>, AppError>>;
  };
};

const bridge = buildBridge(Object.keys(contract) as ChannelName[], invoke);

contextBridge.exposeInMainWorld('ycore', bridge);
