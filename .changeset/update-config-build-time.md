---
"@ycore/desktop": patch
---

Embebe la config pública de updates (URL del Worker, secreto HMAC, claves públicas
Ed25519) como literales en build time (ADR-0006), en vez de leerla de variables de
entorno que un `.exe` instalado nunca tendría. Un build de release sin esta config
falla el CI explícitamente en vez de publicar un instalador que nunca podrá avisar
de sus propias actualizaciones. `pnpm dev` local queda inerte por defecto, salvo que
se cree un `apps/desktop/.env.local` (ver `.env.example`).
