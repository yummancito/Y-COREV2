/**
 * `SettingsService` — lee y actualiza `AppSettings`, aplicando parches parciales.
 *
 * Sirve como la única lógica de negocio de la feature: `settings.update` del
 * contrato IPC manda solo los campos que cambian (`Partial<AppSettings>` sin
 * `schemaVersion`), y este servicio es quien los fusiona con lo ya guardado
 * antes de persistir — el repositorio solo sabe leer/escribir el objeto
 * completo.
 */

import type { AppSettings } from '@ycore/core-domain';
import { SettingsRepository } from './repository.js';

/**
 * Los campos que `settings.update` puede cambiar — nunca `schemaVersion`, que
 * gestiona la migración. `| undefined` explícito en cada campo porque Zod
 * `.partial()` produce ese tipo bajo `exactOptionalPropertyTypes: true`
 * (una clave ausente y una clave presente con valor `undefined` se
 * distinguen a nivel de tipos).
 */
export type SettingsPatch = { [K in keyof Omit<AppSettings, 'schemaVersion'>]?: AppSettings[K] | undefined };

/**
 * Fusiona solo las claves realmente presentes en `patch` sobre `current`.
 *
 * `Object.assign`/`{ ...current, ...patch }` sobrescribirían un campo con
 * `undefined` si `patch` lo trae explícito (Zod `.partial()` con
 * `exactOptionalPropertyTypes` permite esa forma) — aquí se filtra con
 * `Object.entries` para que una clave ausente en `patch` nunca borre el
 * valor ya guardado de `current`.
 */
function mergeDefined(current: AppSettings, patch: SettingsPatch): AppSettings {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  /** Los settings actuales, ya migrados a la versión de esquema vigente. */
  read(): AppSettings {
    return this.repository.read();
  }

  /**
   * Aplica un parche parcial sobre los settings actuales y persiste el
   * resultado.
   * @returns Los settings completos ya actualizados.
   */
  update(patch: SettingsPatch): AppSettings {
    const current = this.repository.read();
    const next = mergeDefined(current, patch);
    this.repository.write(next);
    return next;
  }
}
