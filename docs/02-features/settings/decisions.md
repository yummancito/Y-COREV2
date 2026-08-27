# Ajustes — decisiones locales

Decisiones de implementación de esta feature que no ameritaron un ADR (no cambian una
frontera del monorepo ni una decisión ya cerrada en un ADR aceptado).

## `AppSettings` vive en `core-domain`, el schema Zod en `ipc-contract`

Mismo patrón que `DownloadState` (ADR-0004): el tipo puro (sin Zod, porque
`core-domain` solo puede depender de `@ycore/result`) vive en
`packages/core-domain/src/app-settings.ts`; `appSettingsSchema` en
`packages/ipc-contract/src/channels/settings.ts` espeja esa forma campo a campo, sin
importar `core-domain`. Mezclar los dos (poner el schema Zod dentro de
`core-domain`, o importar `core-domain` desde el contrato) rompería la regla de
boundaries que aísla la frontera IPC del tipo interno del dominio.

## Se reutiliza la tabla `settings` genérica en vez de una tabla dedicada

La Fase 5 (ADR-0005) ya creó una tabla clave-valor `settings` para el `clientId` del
rollout. En vez de una migración nueva con columnas dedicadas para cada ajuste
(`language TEXT`, `update_channel TEXT`, ...), `SettingsRepository` guarda
`AppSettings` completo como un único valor JSON bajo la clave `"appSettings"`. Un
campo nuevo en `AppSettings` no necesita ninguna migración de Drizzle — solo un
incremento de `SETTINGS_SCHEMA_VERSION` y, si hace falta, un paso de migración dentro
de `migrateSettings`.

## `SettingsService.update` filtra `undefined` explícito a mano, no con spread

`{ ...current, ...patch }` sobrescribiría un campo con `undefined` si `patch` lo trae
explícito — y con `exactOptionalPropertyTypes: true`, Zod `.partial()` produce
justamente esa forma (una clave ausente y una clave presente con valor `undefined`
son dos cosas distintas a nivel de tipos, aunque casi nunca lo sean en la intención
real del llamador). `mergeDefined()` en `service.ts` recorre `Object.entries(patch)`
y solo copia las claves cuyo valor no es `undefined`, así una clave ausente en el
parche nunca borra el valor ya guardado.

## `SettingsPatch` (tipo TS) no se exporta desde el barrel de la feature

Se define en `service.ts` y se usa dentro del propio archivo y en `handlers.ts` (que
lo importa directo, no desde `index.ts`) — no hay ningún consumidor fuera de la
feature que lo necesite, así que exportarlo desde `index.ts` sería código sin
consumidor real (`knip` lo marcaría como no usado, y de hecho lo hizo durante el
desarrollo — ver `aprendizaje.md`).

## El selector de idioma no traduce nada todavía

`AppSettings.language` se guarda y se lee correctamente de punta a punta, pero
`packages/i18n` (reservado en `boundaries.md`, sin código todavía) no existe — el
selector cambia un valor persistido sin ningún efecto visible en la interfaz. Es
intencional para esta iteración: la Fase 6 del roadmap agrupa "Settings tipados" e
"i18n completo" como dos piezas separadas, y esta feature entrega la primera con la
segunda como consumidor futuro ya listo para conectar (el campo existe, el contrato
existe, solo falta el motor de traducción en sí).
