---
"@ycore/desktop": minor
"@ycore/ipc-contract": minor
---

Añade `DownloadService` (Fase 4, ADR-0004): orquesta el ciclo completo de una descarga
(descargar → verificar → extraer → instalar) contra la máquina de estados de
`@ycore/core-domain`, con deduplicación en memoria (`Map<id, AbortController>`) y
límite de ancho de banda opcional vía `TokenBucket`. Verificado el criterio de HECHO más
duro de la fase: una descarga interrumpida por `kill -9` se retoma desde el offset
exacto persistido en el próximo arranque (`resumeInterrupted()`).

Nuevo canal `downloads.*` (`enqueue`, `list`, `pause`, `cancel`) en `packages/
ipc-contract`. El renderer lee el progreso con polling de `downloads.list` — no hay
eventos push main→renderer en este repo todavía; ver `docs/02-features/downloads/
decisions.md`.

Con esto el lado main de Fase 4 queda completo. Falta el renderer.
