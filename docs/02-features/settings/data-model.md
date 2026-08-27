# Ajustes — modelo de datos

## `AppSettings` (`@ycore/core-domain`)

```ts
interface AppSettings {
  schemaVersion: 1;                          // SETTINGS_SCHEMA_VERSION
  language: string | null;                    // null = seguir el idioma del SO
  updateChannel: 'stable' | 'beta';
  maxDownloadBytesPerSecond: number | null;   // null = sin límite
  discordRichPresenceEnabled: boolean;
  closeToTray: boolean;
}
```

`DEFAULT_APP_SETTINGS` es el valor con el que arranca un perfil nuevo (sin fila
todavía en la tabla `settings`): `language: null`, `updateChannel: 'stable'`,
`maxDownloadBytesPerSecond: null`, `discordRichPresenceEnabled: true`,
`closeToTray: false`.

## Persistencia: reutiliza la tabla `settings` (Fase 5)

No hay una tabla dedicada. `SettingsRepository` guarda el objeto completo como un
único JSON bajo la clave `"appSettings"` en la misma tabla clave-valor genérica que
`ClientIdRepository` usa para el `clientId` del rollout (ADR-0005):

```sql
-- fila real en la tabla settings
key   = 'appSettings'
value = '{"schemaVersion":1,"language":"es","updateChannel":"stable",...}'
```

## Migración de esquema

`migrateSettings(stored: unknown): AppSettings` es la única función que decide qué
hacer con un valor leído de disco:

- Si `stored` no es un objeto (corrupto, `null`, un string cualquiera) →
  `DEFAULT_APP_SETTINGS`.
- Si `stored.schemaVersion` coincide con `SETTINGS_SCHEMA_VERSION` actual → se
  fusiona sobre los defaults (rellena cualquier campo que falte) y se devuelve.
- Si `stored.schemaVersion` es cualquier otro valor (versión futura desconocida, o
  una versión antigua sin migración escrita todavía) → `DEFAULT_APP_SETTINGS`.

Cuando aparezca la versión 2 del esquema, el `switch`/cadena de `if` dentro de
`migrateSettings` gana un caso por cada versión antigua conocida, que transforma el
objeto y cae hasta la versión actual — nunca un salto directo de v1 a v3 sin pasar
por v2. Hoy no existe ninguna migración real: `SETTINGS_SCHEMA_VERSION` empezó en 1,
así que el único camino es "está en la versión actual" o "se descarta a defaults".

## Fusión de un parche parcial (`SettingsService.update`)

`settings.update` del contrato IPC manda `Partial<Omit<AppSettings, 'schemaVersion'>>`
— solo los campos que cambian. El servicio lee lo ya guardado, fusiona campo a campo
(ignorando explícitamente cualquier valor `undefined` del parche, para que un campo
ausente nunca borre lo ya guardado — ver [decisions.md](decisions.md)), y persiste el
resultado completo.

## Forma del canal IPC (`packages/ipc-contract/src/channels/settings.ts`)

```ts
// settings.get.input
{}

// settings.get.output
{ settings: AppSettings }

// settings.update.input
{ settings: Partial<Omit<AppSettings, 'schemaVersion'>> }

// settings.update.output
{ settings: AppSettings }   // el objeto COMPLETO ya actualizado, no solo el parche
```

`settings.update` siempre devuelve el objeto completo (no solo lo que cambió) para
que el renderer pueda usar la respuesta directamente como el nuevo estado sin tener
que fusionar nada por su cuenta.
