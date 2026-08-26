# Servicio: update-worker

Fase 5 del roadmap (ADR-0005). El backend de actualizaciones de la propia app —
`GET /v1/check`, `GET /v1/download`, `POST /v1/admin/*` — desplegado como un Cloudflare
Worker. No sirve juegos ni resuelve catálogos: eso es frontera de otra fase (ver ADR-0005,
sección "Frontera").

## Qué hace (cuando esté completo)

- Decide, para un cliente concreto, si está al día, si hay una versión nueva para su
  canal (con rollout determinista por `clientId`), o si su versión está bloqueada
  (kill-switch).
- En modo mantenimiento, responde **exactamente igual** que "estás al día" — el cliente
  no puede distinguirlo (ADR-0003).
- Sirve los binarios desde R2 (privado) con URLs firmadas de vida corta, con soporte de
  `Range` para la descarga diferencial por blockmap.
- Los endpoints admin (`maintenance`, `release`, `stats`) los usa la CLI `ycore`,
  autenticados por bearer token.

## Cómo encaja

```
services/update-worker/
├── wrangler.jsonc              bindings: KV CONFIG, D1 DB, R2 RELEASES
├── vitest.config.ts             cloudflarePool: tests dentro de workerd real, sin cuenta
├── migrations/                  SQL crudo numerado (wrangler d1 migrations), no Drizzle
└── src/
    ├── env.ts                   WorkerEnv: bindings generados + secrets (YCORE_CLIENT_SECRET, YCORE_ADMIN_TOKEN)
    └── domain/                  PURO — sin bindings, sin fetch. Lo que se testea de verdad.
        ├── rollout.ts            bucket determinista = SHA-256(clientId:version) mod 100
        ├── signed-url.ts         firma y verificación HMAC de URLs de descarga (TTL 15 min)
        ├── decide.ts             (config, release, clientId) -> up-to-date | update-available | blocked
        ├── config.ts             tipos del estado de KV (YCoreConfig)
        └── release-record.ts     tipos de una fila de D1 (releases)
```

- `packages/update-contract` — schemas Zod compartidos con `packages/updater-client`, ver
  [ADR-0005](../../adr/0005-update-worker-en-cloudflare.md).

## Estado

**En construcción: el dominio puro está completo y testeado** (`rollout`, `decide`,
`signed-url`, `config`, `release-record`) — 24 tests contra `workerd` real vía
`@cloudflare/vitest-pool-workers`/Miniflare, ~96% de cobertura, cero cuenta de
Cloudflare necesaria para correrlos.

**Todavía no existen**: `src/index.ts` (el único `fetch` handler y la tabla de rutas),
`src/routes/*` (traducen HTTP ↔ `Result` del dominio), `src/data/*` (lectura/escritura
real de KV/D1/R2), `src/http/*` (`responses.ts`, `auth.ts`), las migraciones D1, y
`tools/cli` para administrar el servicio. Sin `index.ts`, este servicio **no es
desplegable todavía** — es solo la lógica que decidirá qué responder, ya verificada de
forma aislada.

Ver [ADR-0005](../../adr/0005-update-worker-en-cloudflare.md) para las ocho decisiones
completas de diseño (framework, testing, estructura, errores, firma Ed25519 en CI, HMAC
anti-scraping, URLs firmadas, qué se testea local vs. manual).
