# Actualizaciones — recorridos de usuario

## Ver que hay una actualización

`UpdateBanner` (montado en `App.tsx`, sobre la biblioteca) no renderiza nada mientras la
app está al día — la misma indistinguibilidad que el modo mantenimiento del Worker
(ADR-0003): si no hay nada que decir, no se dice nada.

En cuanto `useUpdateStatusQuery` reporta una fase distinta de `up-to-date`, aparece un
mensaje:

- `available`: "Descargando la actualización a la versión X…" — la descarga ya arrancó
  en segundo plano en el main, el usuario solo ve que está en curso.
- `downloading`: "Descargando actualización X (N%)…" si se conoce el tamaño total, o
  sin porcentaje si no.
- `ready-to-install`: "Hay una actualización lista: versión X." con un botón "Instalar
  y reiniciar".
- `failed`: "No se pudo completar la actualización. Se reintentará automáticamente." —
  sin detalle técnico del error; el siguiente ciclo de `checkNow()` (cada 6 horas) lo
  reintenta solo.

El banner se refresca por **polling** (`useUpdateStatusQuery`, mismo patrón que
`useDownloadsQuery`): cada segundo mientras hay actividad, cada minuto en `up-to-date`.

## Instalar una actualización lista

El botón "Instalar y reiniciar" solo aparece en fase `ready-to-install`. Al pulsarlo,
`useInstallUpdate` llama a `updates.installNow`, que lanza el instalador NSIS en modo
silencioso (`spawnSilentInstaller`, flag `/S`, sin diálogos) y cierra Y-CORE
inmediatamente. No hay confirmación intermedia ni barra de progreso de la instalación
en sí: el instalador corre fuera del proceso de Y-CORE, que ya terminó.

## Lo que no existe todavía

No hay ninguna pantalla de "Ajustes" para elegir canal (`stable`/`beta`) ni para
desactivar las comprobaciones automáticas — `UpdateServiceConfig.channel` está fijado a
`'stable'` en el bootstrap. Tampoco hay una barra de progreso real de descarga: el
porcentaje del banner es el único indicador, sin velocidad ni tiempo estimado (a
diferencia de `DownloadRow` en la feature Descargas, que si los muestra para las
descargas de juegos).
