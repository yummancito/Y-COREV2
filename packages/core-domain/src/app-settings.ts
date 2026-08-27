/**
 * `AppSettings` — la configuración editable por el usuario, y su migración de esquema.
 *
 * Sirve como el tipo puro que valida el schema Zod de `packages/ipc-contract`
 * (`settings.get`/`settings.update`) y que persiste
 * `main/features/settings/repository.ts` — igual patrón que `DownloadState`:
 * el contrato IPC espeja esta forma sin importarla, para no acoplar la
 * frontera IPC al tipo interno del dominio (roadmap, sección A.3).
 *
 * Puro: sin I/O, sin Zod (`core-domain` solo depende de `@ycore/result`).
 */

/** Los canales de actualización disponibles — mismo tipo que usa `updates.*` (ADR-0003). */
export type UpdateChannel = 'stable' | 'beta';

/**
 * La versión actual del esquema de settings. Se incrementa cada vez que
 * `AppSettings` cambia de forma (campo nuevo, campo eliminado, tipo distinto)
 * — `migrateSettings` usa este número para saber qué migraciones aplicar a un
 * valor guardado con una versión anterior.
 */
export const SETTINGS_SCHEMA_VERSION = 1;

/** La configuración completa, tal como la ve el resto de la app. */
export interface AppSettings {
  readonly schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  /** Idioma de la interfaz. `null` = seguir el idioma del sistema operativo. */
  readonly language: string | null;
  /** Canal de actualizaciones suscrito — ver `apps/desktop/src/main/features/updates`. */
  readonly updateChannel: UpdateChannel;
  /** Límite de ancho de banda para descargas, en bytes/segundo. `null` = sin límite. */
  readonly maxDownloadBytesPerSecond: number | null;
  /** Presencia enriquecida de Discord ("jugando a X"). Se ignora en silencio si Discord no está abierto. */
  readonly discordRichPresenceEnabled: boolean;
  /** Minimizar a la bandeja del sistema en vez de cerrar al pulsar la X de la ventana. */
  readonly closeToTray: boolean;
}

/** Los valores con los que arranca un perfil nuevo — primer arranque, sin fila en la DB todavía. */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  language: null,
  updateChannel: 'stable',
  maxDownloadBytesPerSecond: null,
  discordRichPresenceEnabled: true,
  closeToTray: false,
};

/**
 * Migra un objeto de settings guardado con una versión de esquema anterior a
 * la versión actual, aplicando cada paso de migración en orden.
 *
 * Sirve para que un cambio de forma en `AppSettings` (roadmap, Fase 6:
 * "Settings tipados con Zod y migración de esquema") no obligue a los
 * usuarios existentes a perder su configuración guardada — el repositorio
 * llama a esto antes de exponer el valor leído de disco.
 *
 * @param stored - El objeto ya parseado desde JSON, de forma desconocida
 *   (puede venir de una versión de esquema anterior, o de una escritura
 *   manual corrupta).
 * @returns Los settings migrados a `SETTINGS_SCHEMA_VERSION`. Si `stored` no
 *   tiene ni `schemaVersion` reconocible ni forma parseable, devuelve
 *   {@link DEFAULT_APP_SETTINGS} — perder un ajuste corrupto es preferible a
 *   que la app no arranque.
 */
export function migrateSettings(stored: unknown): AppSettings {
  if (typeof stored !== 'object' || stored === null) return DEFAULT_APP_SETTINGS;

  const record = stored as Record<string, unknown>;
  const version = typeof record['schemaVersion'] === 'number' ? record['schemaVersion'] : 0;

  // Sin migraciones todavía: SETTINGS_SCHEMA_VERSION empezó en 1. Cuando
  // aparezca la versión 2, este switch gana un `case 1: record = migrateV1ToV2(record);`
  // y el fallthrough sigue hasta la versión actual — nunca un salto directo.
  if (version === SETTINGS_SCHEMA_VERSION) {
    return { ...DEFAULT_APP_SETTINGS, ...record, schemaVersion: SETTINGS_SCHEMA_VERSION };
  }

  return DEFAULT_APP_SETTINGS;
}
