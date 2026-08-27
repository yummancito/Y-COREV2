# Feature: Ajustes

Fase 6 del roadmap. Configuración editable por el usuario, tipada con Zod y con
migración de esquema — persistida en la misma tabla `settings` que ya usa la feature
Actualizaciones para el `clientId` (Fase 5, ADR-0005).

## Qué hace

- Guarda idioma de la interfaz, canal de actualizaciones (`stable`/`beta`), límite de
  ancho de banda para descargas, si se muestra presencia enriquecida en Discord, y si
  cerrar la ventana minimiza a la bandeja en vez de salir.
- Cada cambio desde el renderer manda solo el campo que cambió (`settings.update` con
  un parche parcial) — el servicio del main fusiona ese parche con lo ya guardado,
  nunca hace falta mandar el objeto completo.
- Si el JSON guardado está corrupto, o es la primera vez que arranca la app, cae en
  los valores por defecto (`DEFAULT_APP_SETTINGS`) en vez de fallar.
- La forma de `AppSettings` lleva un número de versión de esquema
  (`SETTINGS_SCHEMA_VERSION`); un valor guardado con una versión anterior se migra al
  leerlo, para que un cambio de forma futuro no borre la configuración de nadie.

## Cómo encaja

```
packages/core-domain/
  app-settings.ts          AppSettings (tipo puro), DEFAULT_APP_SETTINGS, migrateSettings()

apps/desktop/src/main/features/settings/
  repository.ts             tabla `settings` (clave "appSettings", valor JSON) <-> AppSettings
  service.ts                 fusiona un parche parcial con lo ya guardado
  handlers.ts                 traduce dominio <-> forma exacta del contrato IPC
  index.ts                    API pública: SettingsRepository, SettingsService, createSettingsHandlers

apps/desktop/src/renderer/features/settings/
  index.ts                     API pública: SettingsPanel
  hooks/                        useSettingsQuery (sin polling: no cambia solo), useUpdateSettings
  components/                   SettingsPanel (único componente: no hay pantalla propia todavía)
```

- `packages/ipc-contract` — canales `settings.get`, `settings.update`, ver
  [ipc-channels.md](ipc-channels.md). `appSettingsSchema` espeja `AppSettings` sin
  importar `core-domain`, mismo patrón que `downloadStateSchema` en la feature
  Descargas.

Ver [data-model.md](data-model.md) para la forma completa de `AppSettings` y cómo
funciona la migración de esquema, [decisions.md](decisions.md) para decisiones
locales, [ui-flows.md](ui-flows.md) para los recorridos de usuario.

## Estado

**Completo para los cinco ajustes actuales**: lectura, actualización parcial,
migración de esquema, IPC, y el panel del renderer. 100% de cobertura en
`core-domain/app-settings.ts` y en la feature del main; el panel del renderer no
cambia el idioma real de la interfaz todavía (ver
[decisions.md](decisions.md#el-selector-de-idioma-no-traduce-nada-todavia)).
