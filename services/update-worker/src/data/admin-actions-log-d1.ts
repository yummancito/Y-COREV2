/**
 * Acceso a la tabla D1 `admin_actions_log` (migración `0002_admin_actions_log.sql`).
 *
 * Sirve para auditar `yank`, `rollout` y `block` — el resto de operaciones
 * admin que, a diferencia de `maintenance` (que tiene su propia
 * `maintenance_log`), no cambiaban el comportamiento de todos los clientes a
 * la vez sin dejar rastro de quién y por qué.
 */

import { err, ok, type Result } from '@ycore/result';
import { fromUnknown, type AppError } from '@ycore/result/app-error';

/** Una acción admin auditada — ver `INSERT INTO admin_actions_log`. */
export interface AdminActionLogEntry {
  readonly action: 'yank' | 'rollout' | 'block';
  readonly version: string | null;
  readonly channel: string | null;
  readonly actor: string;
  readonly detail: string | null;
  readonly at: string;
}

/** Inserta una fila de auditoría de una acción admin. */
export async function insertAdminActionLogEntry(db: D1Database, entry: AdminActionLogEntry): Promise<Result<void, AppError>> {
  try {
    await db
      .prepare('INSERT INTO admin_actions_log (action, version, channel, actor, detail, at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(entry.action, entry.version, entry.channel, entry.actor, entry.detail, entry.at)
      .run();
    return ok(undefined);
  } catch (error) {
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }
}
