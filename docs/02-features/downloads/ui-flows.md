# Descargas — recorridos de usuario

## Ver la cola de descargas

`DownloadsList` (montada en `App.tsx`, bajo la biblioteca) muestra todas las descargas
conocidas. Mientras `useDownloadsQuery` está cargando, un mensaje de "Cargando
descargas…"; si la cola está vacía, "No hay descargas en la cola."; si falla, el
mensaje de error con el código del `AppError`.

Cada fila (`DownloadRow`) muestra: el `appId`, el estado legible en español (`En cola`,
`Descargando`, `Pausado`, `Verificando`, `Extrayendo`, `Instalando`, `Completado`,
`Falló`), una barra de progreso (`<progress>`) cuando hay `bytesTotal` conocido, y el
código de error si el estado es `failed`.

Mientras haya al menos una descarga no terminal, la lista se refresca sola cada
500 ms (polling, no push — ver [decisions.md](decisions.md)) sin que el usuario haga
nada.

## Pausar una descarga

El botón "Pausar" solo está habilitado si el estado es `downloading`. Al pulsarlo,
`usePauseDownload` llama a `downloads.pause` e invalida la cola — la fila pasa a
`Pausado` en el siguiente refresco (inmediato, por la invalidación; no hace falta
esperar al poll).

## Cancelar una descarga

El botón "Cancelar" está habilitado en cualquier estado salvo `done` (no tiene sentido
cancelar algo que ya terminó). Al pulsarlo, `useCancelDownload` llama a
`downloads.cancel`, que borra la fila y el archivo parcial; la fila desaparece de la
lista en el siguiente refresco.

## Lo que no existe todavía

No hay ningún botón "Descargar" ni formulario para encolar una descarga nueva desde la
UI: `useEnqueueDownload` existe y está testeado, pero ningún componente lo llama. Iniciar
una descarga real requiere saber de dónde sale la URL y el hash esperado — eso es
responsabilidad de una feature futura (posiblemente integrada con Steam o un catálogo),
no de esta pantalla. Ver el README, sección "Estado".
