---
"@ycore/core-domain": minor
"@ycore/result": minor
---

Añade el núcleo puro del motor de descargas (Fase 4, ADR-0004): `transition()` y la
tabla `ALLOWED_TRANSITIONS` de la máquina de estados de una descarga (unión
discriminada por `status`, un estado inválido no se puede expresar), `ProgressThrottle`
(agrupa progreso a ~4 eventos/s sin perder el último antes de una transición) y
`TokenBucket` (límite de ancho de banda). Los tres son puros y testeados con reloj
inyectado, sin I/O ni Electron. `@ycore/result` gana los códigos de error
`download.invalid-transition`, `download.integrity-mismatch`, `download.duplicate` y
`download.zip-slip`.
