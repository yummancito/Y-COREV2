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
import type { Registry } from './registry.js';

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
async function runChannel(
  registry: Registry,
  channel: ChannelName,
  rawPayload: unknown,
): Promise<Result<unknown, AppError>> {
  const definition = contract[channel];

  const parsedInput = definition.input.safeParse(rawPayload);
  if (!parsedInput.success) {
    log.warn('input inválido', { channel, issues: parsedInput.error.issues });
    return err(appError('ipc.invalid-input', { context: { channel } }));
  }

  // TS no puede probar que `channel` correlaciona su propio handler con su
  // propio input dentro de un lookup dinámico sobre una unión discriminada —
  // el cast es seguro porque isKnownChannel() y el tipo Registry (que exige
  // las 100% de las claves de ChannelName) garantizan la correspondencia 1:1
  // en runtime; safeParse ya validó el shape real del payload arriba.
  const handler = registry[channel] as (input: unknown) => Promise<Result<unknown, AppError>>;
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
 * Electron de verdad — ver router.test.ts. Recibe `registry` como parámetro
 * (no lo importa) para no acoplar el router a cómo se construye — el registry
 * necesita la conexión de DB real, que solo existe tras `openAppDatabase()`
 * en el bootstrap.
 */
export async function handleIpcRequest(
  registry: Registry,
  _event: unknown,
  request: IpcRequest,
): Promise<Result<unknown, AppError>> {
  const { channel, payload } = request;

  if (!isKnownChannel(channel)) {
    log.warn('canal desconocido', { channel });
    return err(appError('ipc.unknown-channel', { context: { channel } }));
  }

  try {
    return await runChannel(registry, channel, payload);
  } catch (error) {
    log.error('el handler lanzó una excepción no controlada', { channel });
    return err({ ...fromUnknown(error), code: 'ipc.handler-crashed' });
  }
}

/**
 * Registra el único `ipcMain.handle` del proceso. Se llama una vez desde el
 * bootstrap de arranque (`main/bootstrap/`), nunca desde una feature.
 */
export function registerIpcRouter(registry: Registry): void {
  ipcMain.handle(IPC_ENTRY_POINT, (event: unknown, request: IpcRequest) =>
    handleIpcRequest(registry, event, request),
  );
  log.info('router IPC registrado', { channelCount: Object.keys(contract).length });
}
