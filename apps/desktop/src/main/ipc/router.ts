/**
 * `registerIpcRouter` — el único `ipcMain.handle` de todo Y-CORE (ADR-0002).
 *
 * Sirve como el único punto de entrada del renderer al main process: recibe el
 * nombre de canal y el payload crudo, valida el input contra el schema Zod del
 * contrato, ejecuta el handler del registry, valida el output, y siempre devuelve
 * un `Result` serializable — nunca deja escapar una excepción hacia el renderer,
 * ni siquiera si el handler tiene un bug y lanza.
 *
 * Es deliberadamente el único archivo del repo con `ipcMain.handle`: el hook
 * `check-file-rules.mjs` (regla R3) bloquea cualquier otro intento de escribirlo
 * en otro sitio.
 */

import { ipcMain } from 'electron';
import { err, isErr, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';
import { contract, type ChannelName } from '@ycore/ipc-contract';
import { createLogger } from '@ycore/logger';
import { registry } from './registry.js';

const log = createLogger('main:ipc:router');

/** Nombre reservado del único canal `ipcMain.handle` que existe en todo el repo. */
export const IPC_ENTRY_POINT = 'ycore:invoke' as const;

/** Payload que el preload manda por el único canal físico de Electron. */
interface IpcRequest {
  readonly channel: string;
  readonly payload: unknown;
}

function isKnownChannel(channel: string): channel is ChannelName {
  return Object.hasOwn(contract, channel);
}

/**
 * Ejecuta un canal ya identificado como válido: valida input, corre el handler,
 * valida output. Separada de {@link handleIpcRequest} porque mezclar la
 * validación de "el canal existe" con "el canal se ejecutó bien" hacía la
 * función original superar el límite de complejidad ciclomática.
 */
async function runChannel(channel: ChannelName, rawPayload: unknown): Promise<Result<unknown, AppError>> {
  const definition = contract[channel];

  const parsedInput = definition.input.safeParse(rawPayload);
  if (!parsedInput.success) {
    log.warn('input inválido', { channel, issues: parsedInput.error.issues });
    return err(appError('ipc.invalid-input', { context: { channel } }));
  }

  const handler = registry[channel];
  const result = await handler(parsedInput.data);
  if (isErr(result)) return result;

  const parsedOutput = definition.output.safeParse(result.value);
  if (!parsedOutput.success) {
    log.error('el handler devolvió un output que no valida', { channel });
    return err(appError('ipc.invalid-output', { context: { channel } }));
  }

  return ok(parsedOutput.data);
}

/**
 * Punto de entrada único invocado por `ipcMain.handle`. Nunca lanza: cualquier
 * excepción no controlada del handler (bug de programación) se captura y se
 * convierte en `AppError` con código `ipc.handler-crashed`.
 *
 * Exportada (no interna) para poder testearla en aislamiento sin levantar
 * Electron de verdad — ver router.test.ts.
 */
export async function handleIpcRequest(_event: unknown, request: IpcRequest): Promise<Result<unknown, AppError>> {
  const { channel, payload } = request;

  if (!isKnownChannel(channel)) {
    log.warn('canal desconocido', { channel });
    return err(appError('ipc.unknown-channel', { context: { channel } }));
  }

  try {
    return await runChannel(channel, payload);
  } catch (error) {
    log.error('el handler lanzó una excepción no controlada', { channel });
    return err({ ...fromUnknown(error), code: 'ipc.handler-crashed' });
  }
}

/**
 * Registra el único `ipcMain.handle` del proceso. Se llama una vez desde el
 * bootstrap de arranque (`main/bootstrap/`), nunca desde una feature.
 */
export function registerIpcRouter(): void {
  ipcMain.handle(IPC_ENTRY_POINT, handleIpcRequest);
  log.info('router IPC registrado', { channelCount: Object.keys(contract).length });
}
