---
"@ycore/update-contract": minor
"@ycore/eslint-config": minor
---

Añade `packages/update-contract` (Fase 5, ADR-0005): schemas Zod compartidos entre
`services/update-worker` y `packages/updater-client` — `CheckRequestSchema`/
`CheckResponseSchema` (unión discriminada `up-to-date`/`update-available`/`blocked`),
`ManifestSchema` (el manifest firmado con Ed25519 fuera del Worker), y
`AdminMaintenanceSchema`/`AdminReleaseSchema` para los endpoints de administración.
Paquete puro, cero I/O, cero dependencias más allá de `zod`.

`@ycore/eslint-config` gana las reglas de boundaries para `update-contract`,
`updater-client` y `update-worker` (este último y `updater-client` todavía no existen
como código, solo la regla que los gobernará cuando se escriban).
