/**
 * Acceso a la tabla D1 `maintenance_log` (roadmap C.3) — auditoría de cada
 * encendido/apagado del modo mantenimiento.
 *
 * Sirve para que activar/desactivar el mantenimiento (que cambia el
 * comportamiento de todos los clientes a la vez, en silencio) quede
 * siempre registrado con quién lo hizo y por qué — nunca es un cambio sin
 * rastro en KV.
 */

import { err, ok, type Result } from '@ycore/result';
import { fromUnknown, type AppError } from '@ycore/result/app-error';

/** Inserta una fila de auditoría del cambio de modo mantenimiento. */
export async function insertMaintenanceLogEntry(
  db: D1Database,
  enabled: boolean,
  actor: string,
  note: string,
  nowIso: string,
): Promise<Result<void, AppError>> {
  try {
    await db
      .prepare('INSERT INTO maintenance_log (enabled, actor, note, at) VALUES (?, ?, ?, ?)')
      .bind(enabled ? 1 : 0, actor, note, nowIso)
      .run();
    return ok(undefined);
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
}
