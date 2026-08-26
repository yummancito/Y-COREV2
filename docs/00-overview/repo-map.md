# Mapa del repositorio

Para qué sirve: da la ubicación real de cada carpeta del monorepo, para no tener que
adivinarla leyendo el roadmap. Se actualiza cada vez que se añade una carpeta nueva
(regla en `.claude/CLAUDE.md`).

Si esta lista y la estructura real del repo no coinciden, gana la estructura real —
abre un issue para corregir este archivo.

---

## `apps/`

| Carpeta | Qué es | Estado |
|---|---|---|
| `apps/desktop` | App de escritorio Electron (main, preload, renderer). El producto. | Fase 2: feature Biblioteca completa (main + renderer). Fase 3 completa: feature Steam. Fase 4 completa: motor de descargas (ADR-0004), main + renderer. |
| `apps/web-landing` | Landing estática "próximamente", en Astro. Se despliega en Cloudflare Pages. | Contenido inicial hecho — ver `docs/00-overview/repo-map.md#apps-web-landing`. |

### `apps/desktop`

```
apps/desktop/
├── electron.vite.config.ts     un config para main+preload+renderer, HMR en los tres
├── src/
│   ├── main/
│   │   ├── index.ts             bootstrap, <150 líneas
│   │   ├── bootstrap/           window.ts, lifecycle.ts, steam-watcher.ts, download-resumer.ts
│   │   └── ipc/
│   │       ├── router.ts        ÚNICO ipcMain.handle del repo (ADR-0002)
│   │       ├── registry.ts      mapa canal → handler
│   │       ├── check-contract.ts   pnpm check:contract — correspondencia contrato↔registry
│   │       └── generate-docs.ts    pnpm docs:ipc — genera docs/01-architecture/ipc-contract.md
│   ├── preload/
│   │   ├── index.ts             expone window.ycore, sin invoke() genérico
│   │   └── build-bridge.ts       arma el árbol {namespace: {verbo: fn}} desde el contrato
│   └── renderer/                App.tsx monta LibraryGrid + DownloadsList (sin router aún)
├── src/main/db/
│   ├── schema.ts                 esquema Drizzle (única fuente de verdad, migra desde aquí)
│   ├── client.ts                 openDatabase(): abre, respalda (.bak) y migra
│   └── migrations/                generadas con `pnpm db:generate`, nunca a mano
├── src/main/features/library/    primera feature vertical (molde canónico)
│   ├── repository.ts              tabla `games` ↔ Game/Installation de core-domain
│   ├── service.ts                 orquesta repository + core-domain + platform
│   └── handlers.ts                traduce dominio ↔ forma exacta del contrato IPC
├── src/main/features/steam/      Fase 3: importar biblioteca real de Steam
│   ├── library-scanner.ts         lee steamapps/appmanifest_*.acf, arma Game[]
│   ├── service.ts                 orquesta library-scanner + LibraryRepository
│   ├── handlers.ts                traduce dominio ↔ forma exacta del contrato IPC
│   └── watcher.ts                 vigila steamapps/ y re-importa solo con debounce
├── src/main/features/downloads/  Fase 4 (ADR-0004): motor de descargas, completo
│   ├── download-record.ts         DownloadState (core-domain) + metadatos fijos
│   ├── repository.ts              tabla `downloads` ↔ DownloadRecord, índice único de dedupe
│   ├── http-client.ts             fetch con Range/If-Range: reanudación real
│   ├── verifier.ts                SHA-256 incremental, verificación final del archivo
│   ├── extractor.ts               ZIP con yauzl, protegido contra zip-slip
│   ├── service.ts                 orquesta todo contra transition() + dedupe en memoria + token bucket
│   └── handlers.ts                traduce dominio ↔ forma exacta del contrato IPC
├── src/main/platform/
│   ├── process-launcher.ts        único lugar que hace spawn() real (lanzar juegos)
│   └── steam-registry.ts          único lugar que lee el registro de Windows (Steam)
├── src/renderer/features/library/    lado renderer del molde canónico
│   ├── hooks/                          useLibraryQuery, useLaunchGame (TanStack Query)
│   └── components/                     GameCard, LibraryGrid
├── src/renderer/features/downloads/  lado renderer del motor de descargas
│   ├── hooks/                          useDownloadsQuery (polling), useEnqueueDownload,
│   │                                    usePauseDownload, useCancelDownload
│   └── components/                     DownloadsList, DownloadRow
├── tools/
│   ├── rebuild-native-for-electron.mjs   recompila better-sqlite3 para la ABI de Electron
│   └── rebuild-native-for-node.mjs       restaura el binding de Node (para los tests)
└── drizzle.config.ts
```

Documentación de la feature Biblioteca en `docs/02-features/library/`, de la feature
Steam en `docs/02-features/steam/`, de la feature Descargas en
`docs/02-features/downloads/`.

**better-sqlite3 y ABI nativa**: el binding compilado no puede ser el mismo para
`pnpm test` (corre bajo Node) y `pnpm dev`/`pnpm build` (corren bajo Electron, ABI
distinta). `pnpm dev`/`pnpm build` corren `rebuild-native-for-electron.mjs`
automáticamente; `pnpm test`/`pnpm check:contract` corren `rebuild-native-for-node.mjs`.
Requiere Visual Studio Build Tools (workload C++) instalado — ver `aprendizaje.md` para
el diagnóstico completo de por qué esto hizo falta.

### `apps/web-landing`

Astro puro, sin framework de UI (decisión del roadmap, sección A.1: "estático, 0 €, sin
React"). Build reproducible con Docker para no depender del entorno de cada PC.

```
apps/web-landing/
├── Dockerfile              build reproducible: node:22-slim + pnpm fijado
├── docker-compose.yml      dev server con hot reload en contenedor
├── astro.config.mjs
├── src/
│   ├── layouts/BaseLayout.astro   <head> común a toda página
│   ├── components/Icon.astro      iconos SVG centralizados (grandes, visibles)
│   └── pages/index.astro          única página por ahora
└── public/
    ├── favicon.svg
    └── styles/global.css          fondo oscuro, sin bordes divisorios entre secciones
```

Decisiones de estilo (a propósito distintas de cualquier referencia externa):

- Fondo oscuro, tipografía clara — el público son jugadores en Windows.
- Iconos SVG dimensionados para ser visibles (36-48px), nunca glifos diminutos.
- Las secciones se separan por espaciado y un degradado sutil de superficie
  (`.seccion--alterna`), no por un `border-top` marcado.

## `packages/`

| Carpeta | Qué es | Estado |
|---|---|---|
| `packages/result` | `Result<T, AppError>` — la pieza que hace cumplir "prohibido throw cruzando fronteras". | Implementado, con tests, cobertura 100%. |
| `packages/logger` | `createLogger(scope)` — el único logger de main/preload/renderer. Formato legible en dev, JSON en producción. | Implementado, con tests. |
| `packages/tsconfig` | `tsconfig` base compartido por todo el monorepo. | Implementado. |
| `packages/eslint-config` | ESLint 9 flat config compartida: límites de tamaño (B.2), boundaries (B.3), no-any y no-raw-ipc (B.1/B.6). | Implementado. |
| `packages/ipc-contract` | El corazón (ADR-0002): mapa de canales IPC con Zod input/output, `.describe()` obligatorio verificado en runtime. | Implementado, con tests, cobertura 100%. Canales `app.ping`, `library.list`, `library.launch`, `steam.importLibrary`, `downloads.enqueue`/`list`/`pause`/`cancel`. |
| `packages/core-domain` | `Game`, `Installation`, `resolveLaunchCommand`, y (Fase 4, ADR-0004) `transition`/`ALLOWED_TRANSITIONS`, `ProgressThrottle`, `TokenBucket` — tipos y reglas puras, cero Electron/`node:fs`. | Implementado, con tests, cobertura 100%. Usado por `main/features/library` y `main/features/downloads`. |
| `packages/steam-kit` | Parsers puros de VDF/ACF: `parseVdf`, `parseLibraryFolders`, `parseAppManifest`, `parseLoginUsers`, `parseDepotKeys`. | Implementado (Fase 3), 40 tests, cobertura ~98%. Recibe contenido ya leído, cero Electron/`node:fs`. |
| `packages/update-contract` | Schemas Zod compartidos por `services/update-worker` y `packages/updater-client` (ADR-0005): `CheckRequestSchema`/`CheckResponseSchema`, `ManifestSchema`, `AdminMaintenanceSchema`/`AdminReleaseSchema`. | Implementado (Fase 5), 23 tests, cobertura 100%. Cero dependencias más allá de `zod` — no depende de `ipc-contract` ni de `result`. |
| `packages/updater-client` | Cliente de actualizaciones (ADR-0003/ADR-0005) para el main process: `checkForUpdate` (silencio total ante cualquier fallo), `signCheckRequest` (HMAC-SHA256), `verifyManifestSignature` (Ed25519, acepta rotación de claves), `verifyArtifactSha512`. | Implementado (Fase 5), 18 tests, ~98% cobertura. Depende solo de `update-contract` y `result`. |

Las demás carpetas de `packages/` que aparecen en el roadmap (`ui-kit`, `i18n`) todavía no
existen — se crean en las fases correspondientes (ver `docs/00-overview/roadmap.md`).

## `services/` y `plugins/`

`plugins/*` vacío (Fase 7+). `services/update-worker` (Fase 5, ADR-0005) completo y
desplegable, falta `tools/cli` y la verificación con cuenta real:

```
services/update-worker/
├── wrangler.jsonc          bindings: KV CONFIG, D1 DB, R2 RELEASES
├── vitest.config.ts         cloudflareTest (plugin de Vite): tests en workerd real, sin cuenta
├── migrations/0001_initial.sql   releases, maintenance_log, check_stats (SQL crudo)
└── src/
    ├── index.ts              ÚNICO export default { fetch } + tabla de rutas
    ├── env.ts                WorkerEnv: bindings generados + secrets
    ├── domain/               PURO — rollout.ts, decide.ts, signed-url.ts, config.ts, release-record.ts
    ├── data/                 KV/D1/R2 real — config-kv, releases-d1, stats-d1, maintenance-log-d1, downloads-r2
    ├── http/                 responses.ts, auth.ts
    └── routes/               check.ts, download.ts, admin/{maintenance,release,stats}.ts
```

Documentación en `docs/03-services/update-worker/`. 73 tests contra `workerd` real,
~90% de cobertura.

## `tools/`

| Carpeta | Qué es |
|---|---|
| `tools/scripts` | Checkers en Node puro que hacen cumplir las reglas de `.claude/CLAUDE.md`: `check-file-rules.mjs` (hook de Write/Edit), `check-docs.mjs`, `check-done.mjs` (hook Stop), `check-staged.mjs` (pre-commit). |
| `tools/cli` | CLI `ycore` para el toggle de mantenimiento y releases. Fase 5. |

## Raíz

Solo existen en la raíz: `README.md`, `CONTRIBUTING.md`, `LICENSE.md`, `SECURITY.md`,
`CHANGELOG.md` y `aprendizaje.md` (registro de errores resueltos, regla de
`.claude/CLAUDE.md`). Cualquier otro `.md` en la raíz es una violación de R2 y el
checker lo bloquea.
