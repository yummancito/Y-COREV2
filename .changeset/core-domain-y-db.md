---
"@ycore/desktop": minor
"@ycore/core-domain": minor
---

Añade `packages/core-domain` (tipos `Game`/`Installation` y `resolveLaunchCommand`,
puros y sin Electron) y `apps/desktop/src/main/db` (esquema Drizzle, migraciones
generadas y `openDatabase()` con backup automático antes de cada migración). Base
para la feature Biblioteca de la Fase 2.
