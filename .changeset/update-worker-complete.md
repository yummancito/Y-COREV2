---
"@ycore/update-worker": minor
"@ycore/update-contract": minor
---

Completa `services/update-worker` (Fase 5, ADR-0005): el `fetch` handler único con su
tabla de rutas (`GET /v1/check`, `GET /v1/download/:version/:kind`, `POST /v1/admin/
maintenance`, `POST /v1/admin/release`, `GET /v1/admin/stats`), el acceso real a KV/D1/
R2 (`data/*`, siempre `Result<T, AppError>`), la auth de los endpoints (`http/auth.ts`)
y las migraciones D1 (`releases`, `maintenance_log`, `check_stats`). 73 tests contra
`workerd` real, ~90% de cobertura, cero cuenta de Cloudflare necesaria para correrlos.

`AdminReleaseSchema` (`@ycore/update-contract`) gana los campos que el pipeline de CI ya
conoce al publicar (`size`, `sha512`, `blockmapSha512`, `estimatedDeltaSize`, `notes`,
`mandatory`) — el Worker nunca inventa esos valores, siempre vienen del manifest ya
firmado.

El servicio queda desplegable. Falta `tools/cli` (el CLI `ycore`) y la verificación
manual con una cuenta real de Cloudflare.
