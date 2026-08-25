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
`service.ts` (todavía no escrito) es quien debe llamar a `transition()` antes de pasarle
el resultado a `save()`. Repetir la validación en el repositorio sería una segunda fuente
de verdad sobre qué transiciones son legales.

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
