/**
 * `ClientIdRepository` — persiste el `clientId` estable del rollout (ADR-0005, punto 6).
 *
 * Sirve para que el "número de rifa" del rollout determinista sea el mismo en
 * cada arranque: si cambiara, un cliente entraría y saldría del rollout en
 * cada arranque (flapping que el ADR-0005 quiere evitar explícitamente). No
 * es un identificador de persona — un UUID v4 generado localmente, sin
 * relación con hardware ni cuenta de usuario.
 */

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { settings, type YCoreDatabase } from '../../db/index.js';

const CLIENT_ID_KEY = 'clientId';

export class ClientIdRepository {
  constructor(private readonly db: YCoreDatabase) {}

  /**
   * Devuelve el `clientId` ya guardado, o genera uno nuevo (UUID v4) y lo
   * persiste si es el primer arranque.
   */
  getOrCreate(): string {
    const row = this.db.select().from(settings).where(eq(settings.key, CLIENT_ID_KEY)).get();
    if (row !== undefined) return row.value;

    const clientId = randomUUID();
    this.db.insert(settings).values({ key: CLIENT_ID_KEY, value: clientId }).run();
    return clientId;
  }
}
