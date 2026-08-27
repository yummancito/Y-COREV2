# Ajustes — recorridos de usuario

## Ver y cambiar la configuración

`SettingsPanel` (montado en `App.tsx`, bajo Descargas) muestra los cinco ajustes
actuales. Mientras `useSettingsQuery` está cargando: "Cargando ajustes…"; si falla:
el mensaje de error con el código del `AppError`.

Cada control dispara `useUpdateSettings` en cuanto cambia (sin botón "Guardar"
separado):

- **Idioma** (`<select>`): "Seguir el idioma del sistema" manda `language: null`;
  cualquier otra opción manda su código (`'es'`, `'en'`).
- **Canal de actualizaciones** (`<select>`): `stable`/`beta`.
- **Presencia en Discord** (checkbox): `discordRichPresenceEnabled`.
- **Minimizar a la bandeja** (checkbox): `closeToTray`.

Cada mutación manda solo el campo que cambió (`{ settings: { language: 'es' } }`, no
el objeto completo) y, al completar, invalida la query de settings — el panel
refleja el nuevo valor de inmediato, sin esperar ningún polling (no lo hay: los
settings no cambian solos).

## Lo que no existe todavía

- **El selector de idioma no traduce nada de verdad.** Cambia el valor guardado en
  `AppSettings.language`, pero la interfaz sigue en español fijo — no hay `packages/i18n`
  implementado todavía (reservado en boundaries, sin código). Ver
  [decisions.md](decisions.md).
- **No hay control para `maxDownloadBytesPerSecond`** en el panel: el campo existe en
  `AppSettings` y `DownloadService` ya acepta el límite en su constructor (ADR-0004),
  pero ningún control de UI lo expone todavía.
- **`closeToTray` no tiene efecto real todavía**: el valor se guarda, pero
  `main/bootstrap/lifecycle.ts` no lo lee — cerrar la ventana sigue cerrando la app
  siempre, sin minimizar a bandeja. Falta la pieza de bandeja del sistema (Fase 6,
  "onboarding, bandeja, atajos globales").
- **`discordRichPresenceEnabled` no controla nada real todavía**: no existe
  integración de Discord Rich Presence en el código — el ajuste está listo para
  cuando esa pieza se implemente (Fase 6, "Discord RPC aislado y opcional").
