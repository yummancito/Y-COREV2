---
"@ycore/cli": minor
"@ycore/eslint-config": minor
---

Añade `tools/cli` (Fase 5, ADR-0005): la CLI `ycore` con los seis comandos de
administración del update-worker — `release`, `maintenance`, `yank`, `rollout`, `block`
y `stats` — contra `POST/GET /v1/admin/*`. Lee `YCORE_WORKER_URL` y `YCORE_ADMIN_TOKEN`
del entorno. **Nunca firma nada**: `release` registra una release cuyo instalador y
manifest ya fueron firmados y subidos a R2 por el pipeline de CI; publicar una release
firmada desde un portátil no es posible por diseño. Parseo de flags escrito a mano
(`--clave valor`), sin dependencias de parsing de CLI.

`@ycore/eslint-config` gana la regla de boundaries para `tools/cli` (solo puede
importar `@ycore/update-contract`).
