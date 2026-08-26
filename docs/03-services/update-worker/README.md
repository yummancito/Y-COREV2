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
├── vitest.config.ts             cloudflareTest (plugin de Vite): tests en workerd real, sin cuenta
├── migrations/
│   └── 0001_initial.sql         releases, maintenance_log, check_stats (SQL crudo, no Drizzle)
└── src/
    ├── index.ts                 ÚNICO export default { fetch } + tabla de rutas
    ├── env.ts                   WorkerEnv: bindings generados + secrets (YCORE_CLIENT_SECRET, YCORE_ADMIN_TOKEN)
    ├── test-migrations.ts        aplica las migraciones reales en tests (cloudflare:test)
    ├── domain/                  PURO — sin bindings, sin fetch
    │   ├── rollout.ts            bucket determinista = SHA-256(clientId:version) mod 100
    │   ├── signed-url.ts         firma y verificación HMAC de URLs de descarga (TTL 15 min)
    │   ├── decide.ts             (config, release, clientId) -> up-to-date | update-available | blocked
    │   ├── config.ts             tipos del estado de KV (YCoreConfig)
    │   └── release-record.ts     tipos de una fila de D1 (releases)
    ├── data/                    habla con KV/D1/R2 real, siempre Result<T, AppError>
    │   ├── config-kv.ts          lectura/escritura de YCORE_CONFIG, validado con Zod
    │   ├── releases-d1.ts        CRUD de la tabla releases (SQL parametrizado)
    │   ├── stats-d1.ts           agregado check_stats, sin PII
    │   ├── maintenance-log-d1.ts  auditoría de encendido/apagado del mantenimiento
    │   └── downloads-r2.ts       lectura del bucket privado, con soporte de Range
    ├── http/
    │   ├── responses.ts          json()/empty()/badRequest()/internalError()
    │   └── auth.ts               bearer del admin (real) + HMAC del cliente (ofuscación, no autenticación)
    └── routes/                  traduce HTTP <-> Result del dominio, un solo punto por ruta
        ├── check.ts              GET /v1/check
        ├── download.ts           GET /v1/download/:version/:kind
        └── admin/{maintenance,release,stats}.ts
```

- `packages/update-contract` — schemas Zod compartidos con `packages/updater-client`, ver
  [ADR-0005](../../adr/0005-update-worker-en-cloudflare.md).

## Estado

**Completo y desplegable** (falta solo `tools/cli` y la verificación manual con cuenta
real de Cloudflare): las cinco rutas, el dominio puro, el acceso a KV/D1/R2, y el `fetch`
handler único. 73 tests contra `workerd` real vía `@cloudflare/vitest-pool-workers`
(plugin `cloudflareTest`), ~90% de cobertura global, cero cuenta de Cloudflare necesaria
para correrlos. Las migraciones D1 se verificaron además con
`wrangler d1 migrations apply --local`.

Ver [ADR-0005](../../adr/0005-update-worker-en-cloudflare.md) para las ocho decisiones
completas de diseño (framework, testing, estructura, errores, firma Ed25519 en CI, HMAC
anti-scraping, URLs firmadas, qué se testea local vs. manual) y
[decisions.md](decisions.md) para decisiones locales encontradas durante la
implementación que no ameritaron ampliar el ADR.

**Todavía no existe**: `tools/cli` (el CLI `ycore` que llama a los endpoints admin), el
pipeline de CI que firma el manifest y publica releases, y la verificación end-to-end
con una cuenta real de Cloudflare (`wrangler deploy`, DNS, e2e con binarios — ver
`docs/05-operations/release-process.md`).
