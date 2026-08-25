/**
 * `registry` — mapa `nombre de canal → handler` que el router ejecuta.
 *
 * Sirve para separar "qué canales existen y qué hace cada uno" (aquí) de "cómo se
 * valida y se conecta a Electron" (router.ts). Una feature nueva añade su entrada
 * aquí — nunca escribe su propio `ipcMain.handle` (ADR-0002, regla B.1).
 *
 * Por ahora solo contiene el canal de referencia `app.ping`; cada feature de main
 * (Fase 2+) suma las suyas siguiendo el mismo patrón.
 */

import { ok, type Result } from '@ycore/result';
import type { AppError } from '@ycore/result/app-error';
import { contract, type ChannelInput, type ChannelName, type ChannelOutput } from '@ycore/ipc-contract';

/**
 * Firma de un handler para el canal `C`: recibe input ya validado, nunca lanza.
 * No se exporta: hoy solo la usa {@link Registry} en este archivo. Cuando una
 * feature real (Fase 2+) escriba sus propios handlers en su `handlers.ts`, se
 * vuelve a exportar desde aquí en vez de duplicar la definición allí.
 */
type ChannelHandler<C extends ChannelName> = (
  input: ChannelInput<(typeof contract)[C]>,
) => Promise<Result<ChannelOutput<(typeof contract)[C]>, AppError>>;

/** Mapa completo `canal → handler`. Debe cubrir el 100% de `ChannelName` (ver check:contract). */
export type Registry = { [C in ChannelName]: ChannelHandler<C> };

function handleAppPing(): Promise<Result<{ pong: true; receivedAt: string }, AppError>> {
  return Promise.resolve(ok({ pong: true, receivedAt: new Date().toISOString() }));
}

/** Registro de todos los handlers, uno por canal del contrato. */
export const registry: Registry = {
  'app.ping': handleAppPing,
};
