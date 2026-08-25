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
