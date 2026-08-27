/**
 * `SettingsRepository` — persiste `AppSettings` como un único JSON en la tabla `settings`.
 *
 * Sirve como el único lugar que traduce entre la fila cruda (clave `appSettings`,
 * valor JSON) y el tipo `AppSettings` de `@ycore/core-domain` — reutiliza la
 * misma tabla clave-valor que `ClientIdRepository` (Fase 5), en vez de crear
 * columnas dedicadas: `migrateSettings` ya resuelve la evolución de forma sin
 * necesitar una migración de esquema de Drizzle por cada campo nuevo.
 */

import { eq } from 'drizzle-orm';
import { migrateSettings, DEFAULT_APP_SETTINGS, type AppSettings } from '@ycore/core-domain';
import { settings, type YCoreDatabase } from '../../db/index.js';

const APP_SETTINGS_KEY = 'appSettings';

export class SettingsRepository {
  constructor(private readonly db: YCoreDatabase) {}

  /**
   * Lee los settings guardados, migrados a la versión de esquema vigente.
   * @returns {@link DEFAULT_APP_SETTINGS} si es el primer arranque (sin fila
   *   todavía) o si el JSON guardado está corrupto — nunca lanza.
   */
  read(): AppSettings {
    const row = this.db.select().from(settings).where(eq(settings.key, APP_SETTINGS_KEY)).get();
    if (row === undefined) return DEFAULT_APP_SETTINGS;

    try {
      return migrateSettings(JSON.parse(row.value));
    } catch {
      return DEFAULT_APP_SETTINGS;
    }
  }

  /** Sobrescribe los settings guardados con el valor completo dado (ya migrado). */
  write(value: AppSettings): void {
    this.db
      .insert(settings)
      .values({ key: APP_SETTINGS_KEY, value: JSON.stringify(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(value) } })
      .run();
  }
}
