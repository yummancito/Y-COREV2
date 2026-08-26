# Descargas — decisiones locales

Decisiones de implementación de esta feature que no ameritaron ampliar el ADR-0004
(no cambian una frontera del monorepo ni una decisión ya cerrada allí).

## `DownloadRecord` separa `DownloadState` (core-domain) de `DownloadMetadata` (feature)

El ADR-0004 deja la máquina de estados en `core-domain` y el I/O en la feature, pero no
especifica cómo se combinan al leer una fila completa de la tabla `downloads` (que tiene
tanto columnas de estado como de metadata fija). Se resolvió con `DownloadRecord`, un
tipo de la propia feature (no de `core-domain`, porque mezclar sourceUrl/rutas/hash en la
unión discriminada del estado habría hecho que cada variante cargara con campos que no
usa).

## Detección del conflicto de índice único por `error.code`, no por parseo de mensaje

`DownloadRepository.insert` distingue un rechazo del índice único parcial
(`downloads_active_app`) de cualquier otro error de DB comprobando
`error.code === 'SQLITE_CONSTRAINT_UNIQUE'` (el código que expone better-sqlite3), no
parseando el texto del mensaje de error en busca del nombre del índice — el mensaje real
de SQLite (`UNIQUE constraint failed: downloads.status`) no incluye el nombre del índice,
solo tabla y columna. Comprobar además que el mensaje menciona `downloads` acota el
chequeo a esta tabla, por si en el futuro hay otro índice único en el mismo proceso.

## `save()` no valida la transición

`DownloadRepository.save(state, updatedAt)` escribe cualquier `DownloadState` que reciba,
sin comprobar que la transición desde el estado anterior sea legal — esa validación es
responsabilidad exclusiva de `transition()` en `core-domain` (ADR-0004, punto 2), y
`DownloadService` es quien llama a `transition()` antes de pasarle el resultado a
`save()`. Repetir la validación en el repositorio sería una segunda fuente de verdad
sobre qué transiciones son legales.

## La protección zip-slip de `extractor.ts` es redundante con `yauzl`, y es intencional

`yauzl` ya rechaza (con su propio `Error`) cualquier entrada de ZIP con un segmento `..`
o una ruta absoluta, antes de que nuestro código llegue a verla. `resolveEntryPath` en
`extractor.ts` repite esa comprobación por su cuenta, contra `installPath` resuelto. Se
mantiene la comprobación propia a pesar de la redundancia porque: (1) es la que hace el
ADR-0004 explícito y auditable sin depender del comportamiento interno de una librería de
terceros, y (2) si `yauzl` cambiara esa validación en una versión futura, la protección de
Y-CORE seguiría en pie. `isPathTraversalError()` reconoce ambas fuentes del mismo error
(el mensaje propio y el de `yauzl`) para que las dos capas devuelvan el mismo
`AppError` `download.zip-slip` al llamador.

## El fixture de test de zip-slip se construye a mano, no con `yazl`

`yazl` (la librería usada para construir ZIPs de prueba normales) valida y rechaza
cualquier `metadataPath` con un segmento `..` — la misma protección que tiene `yauzl` al
leer, pero en el lado de escritura. Para poder testear que `extractZip` rechaza una
entrada maliciosa hace falta un ZIP que contenga esa entrada, así que
`extractor.test-helpers.ts` arma los bytes del formato ZIP a mano (`buildMaliciousZip`),
sin pasar por ninguna librería que valide el nombre.

## Polling de `downloads.list` en vez de eventos push main→renderer

Este repo no tiene todavía ningún patrón main→renderer (solo invoke/handle,
request-response, ADR-0002) — definir uno seguro (allowlist de eventos, mismo espíritu
que el contrato de canales) es una decisión de arquitectura aparte que no se abrió en
esta fase. `useDownloadsQuery` lee el progreso haciendo polling de `downloads.list` con
TanStack Query (`refetchInterval` cada 500 ms mientras haya una descarga no terminal;
se apaga solo cuando todas están en `done`/`failed`) — reutiliza el patrón invoke/handle
que ya existe, a costa de una latencia de hasta 500 ms en vez de progreso instantáneo.
Si en el futuro hace falta progreso más fino, eso es un ADR nuevo sobre eventos
main→renderer, no una ampliación de este contrato.

Las mutaciones (`useEnqueueDownload`, `usePauseDownload`, `useCancelDownload`) invalidan
la query de la cola en `onSuccess`, así que la UI refleja el cambio de inmediato tras la
acción del usuario, sin esperar al siguiente tick de polling — el polling cubre el
progreso que avanza solo (bytes descargados), la invalidación cubre las acciones
explícitas.

## `resumeInterrupted()` no valida `state.status !== 'downloading' -> downloading`

Cuando `resumeInterrupted()` retoma una fila que ya estaba en `downloading` (el proceso
murió a mitad, nadie llamó a `pause()`), `DownloadService.download()` no pasa por
`transition()` para persistir el nuevo `bytesDownloaded`/`bytesTotal`: llama a
`repository.save()` directo. `downloading -> downloading` no está en
`ALLOWED_TRANSITIONS` (ADR-0004, punto 2) a propósito — un estado no transiciona a sí
mismo — así que ese camino tendría que fallar con `download.invalid-transition` si
pasara por `transition()`. Ver `aprendizaje.md` para el bug real que produjo esta
decisión.

## El `TokenBucket` es un límite global por instancia de `DownloadService`, no persistido

`DownloadService` recibe un `maxBytesPerSecond` opcional en su constructor (no en
`EnqueueInput` ni en la tabla `downloads`): es un límite de ancho de banda para todas
las descargas de esa instancia del servicio, no configurable por descarga individual.
No hay UI de Ajustes todavía que lo exponga — `registry.ts` y `download-resumer.ts`
instancian el servicio sin límite. Cuando exista esa UI, este constructor ya admite el
valor; no hace falta ningún cambio de esquema.

## `App.tsx` monta Biblioteca y Descargas juntas, sin router

La misma decisión que ya regía cuando solo existía Biblioteca ("TanStack Router se
añade cuando haga falta navegación real") se extiende: con dos secciones, mostrarlas
ambas en la misma pantalla (`<h1>` + `LibraryGrid` + `<h2>` + `DownloadsList`) sigue
siendo más simple que introducir rutas para dos bloques verticales. El router llega
cuando el número de secciones (o la necesidad de deep-linking) lo justifique, no antes.

## `useEnqueueDownload` existe sin ningún componente que lo llame

El hook está completo y testeado (incluida la invalidación de la cola al completar),
pero `EnqueueDownloadInput` no se exporta desde el barrel de la feature ni desde el
propio archivo, porque no hay ningún flujo de UI que arme ese input todavía — "elegir
qué descargar" (de dónde sale la `sourceUrl` y el `expectedSha256`) es responsabilidad
de una feature futura, no de la pantalla de la cola. Cuando esa feature exista, importa
el hook directo desde `use-enqueue-download.ts` y expone el tipo si hace falta — no se
adelanta la exportación sin un consumidor real (regla general del repo: cero código sin
consumidor, knip lo marcaría).
