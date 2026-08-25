# Y-CORE V2 — Roadmap maestro de reconstrucción

## Contexto

Y-CORE v4.3.12 es un gestor de juegos de Steam en Electron con ~83k líneas propias
(`electron/` 46.5k + `src/` 36.4k). Funciona, pero acumuló deuda que ya bloquea el avance:

- **167 `ipcMain.handle` dispersos** + un "gateway" nuevo a medias que nunca terminó de migrar.
- **`preload.ts` expone un `invoke(channel, ...)` genérico sin allowlist** → agujero de seguridad real:
  el renderer puede llamar a cualquier canal del main.
- Stores duplicados (`useLibraryStore` + `useLibraryV2Store`, `useDownloadQueueStore` + `useDownloadEngineV3Store`).
- `LibraryPage.tsx` de 1985 líneas, `index.css` de 1349 líneas a mano.
- Raíz contaminada: ~90 `.md` de auditorías contradictorias, un `.exe` de 428 MB commiteado,
  14 scripts `_patch_*.cjs` sueltos, un barrel que exporta 14 de 31 servicios.
- Updates vía `electron-updater` → GitHub Releases **públicas**, sin firma, `compression: store` +
  `differentialPackage: false` = ~400 MB por update, bloqueos recurrentes de Windows Defender, y un
  fallback con `https.get` crudo escrito porque "electron-updater's retry() is broken".

**Objetivo:** reconstruir desde cero en un repo nuevo privado `github.com/yummancito/Y-COREV2`,
con cero deuda técnica, secciones bien separadas, todo documentado, control total sobre las
actualizaciones (incluido un **modo mantenimiento** que el dev activa y desactiva), y closed-source
con protección realista **sin presupuesto**.

**Este documento es el mapa. No se escribe código de features hasta cerrar la Fase 0.**

---

## Decisiones ya cerradas

| Tema | Decisión |
|---|---|
| Repo | Nuevo privado `Y-COREV2` + landing "próximamente" |
| Update backend | Cloudflare Worker + R2 + KV + D1 (free tier) |
| Modo mantenimiento | Sí, silencioso — el cliente no distingue "mantenimiento" de "estás al día" |
| Protección | Lógica de valor en el servidor + Ed25519 + Electron Fuses + ofuscación selectiva. **Cero coste.** |
| Presupuesto | 0 € — sin certificado de firma, sin licencias comerciales |

---

## A. Arquitectura objetivo

### A.1 Stack (elegido, no a debatir)

| Área | Elección | Por qué |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | pnpm ya estaba; symlinks estrictos impiden importar lo no declarado |
| Lenguaje | **TS 5.7 strict** + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | La mitad de los bugs del v1 son `undefined` implícitos |
| Desktop | **Electron 33 LTS + electron-vite** | Un solo config, HMR en main y preload; mata los 3 tsconfig sueltos |
| UI | React 19 + **Tailwind 4** + shadcn/ui (copiado, no dep) | Tailwind 4 configura en CSS → adiós al `index.css` de 1349 líneas |
| Estado | **zustand (solo UI) + TanStack Query (todo lo que venga de IPC)** | La duplicación V1/V2 nació de meter datos del backend en zustand |
| Router | **TanStack Router** (file-based, tipado) | Sin strings mágicos |
| Validación | **Zod v4** | Un esquema = tipo TS + validación runtime del IPC |
| DB local | **better-sqlite3 + Drizzle + migraciones versionadas** | Adiós a los JSON sueltos |
| Tests | **Vitest** + **Playwright** (e2e Electron) | Ya existían, se formalizan |
| Lint | ESLint 9 flat + **eslint-plugin-boundaries** + type-aware | Ver sección B |
| Formato | **Biome** | Un binario; ESLint queda solo para reglas de arquitectura |
| Versionado | **Changesets + Conventional Commits + commitlint** | Changelog automático |
| Landing | **Astro** en Cloudflare Pages | Estático, 0 €, sin React |

### A.2 Estructura de carpetas

```
Y-COREV2/
├── .changeset/
├── .claude/                        # El "sistema inmune" del repo — sección E
│   ├── CLAUDE.md                   # Reglas duras (se leen siempre)
│   ├── agents/  skills/  hooks/  settings.json
├── .github/
│   ├── workflows/ci.yml            # lint+typecheck+test+knip+boundaries (cada PR)
│   ├── workflows/release-desktop.yml   # solo en tag v*: build Win → R2 → manifest firmado
│   ├── workflows/deploy-worker.yml, deploy-landing.yml
│   └── PULL_REQUEST_TEMPLATE.md    # checklist: doc / ADR / test / changeset
│
├── apps/
│   ├── desktop/                    # Solo composición, casi cero lógica de negocio
│   │   ├── electron.vite.config.ts
│   │   ├── electron-builder.yml
│   │   └── src/
│   │       ├── main/
│   │       │   ├── index.ts        # <150 líneas: bootstrap y nada más
│   │       │   ├── bootstrap/      # ciclo de vida, ventanas, single-instance
│   │       │   ├── ipc/
│   │       │   │   ├── router.ts   # ÚNICO ipcMain.handle del repo entero
│   │       │   │   └── registry.ts # mapa contrato→handler, validado con Zod
│   │       │   ├── features/       # verticales: library/ steam/ downloads/ updates/ settings/ saves/
│   │       │   ├── platform/       # adaptadores SO: fs, registry, procesos, elevación
│   │       │   └── db/             # drizzle schema + migraciones
│   │       ├── preload/index.ts    # SOLO métodos del allowlist generado. Sin invoke() genérico.
│   │       └── renderer/
│   │           ├── app/            # router, providers, layout raíz
│   │           ├── features/       # espejo vertical del main
│   │           │   └── library/{components,hooks,store.ts,index.ts}
│   │           └── shared/{ui,lib,styles}
│   └── web-landing/                # Astro "próximamente" → luego changelog público
│
├── packages/
│   ├── ipc-contract/               # EL CORAZÓN. Zod por canal. Genera tipos + allowlist + cliente.
│   ├── core-domain/                # Game, Depot, Manifest, Version. Cero I/O. Testeable sin Electron.
│   ├── steam-kit/                  # Parsers VDF/ACF/manifests/depots. Puro. Portado del v1.
│   ├── updater-client/             # Cliente propio del update service. Sin electron-updater.
│   ├── ui-kit/  logger/  result/  i18n/
│   └── tsconfig / eslint-config / biome-config
│
├── plugins/                        # Cargados aparte (Fase 7+)
│   ├── drm-tools/  online-fix/  remote-play/
│
├── services/update-worker/         # Worker: /check, /download, /admin + wrangler + migrations D1
├── tools/cli/                      # `ycore` CLI: release, maintenance on/off, rollout
├── tools/scripts/                  # scripts de build, en TS, documentados
├── docs/                           # sección E
└── turbo.json  pnpm-workspace.yaml  README.md  CONTRIBUTING.md
```

### A.3 Por qué cada frontera

- **`ipc-contract` como paquete separado**: única forma de que main, preload y renderer compartan
  la misma verdad. Si vive dentro de `apps/desktop`, alguien acabará importando el handler desde
  el renderer. Como paquete, pnpm lo impide físicamente.
- **`core-domain` y `steam-kit` sin Electron**: permite testear el 70% de la lógica en Node puro,
  en milisegundos. Ahí van los algoritmos que sí valen del v1.
- **`plugins/` fuera de `apps/desktop/src`**: DRM, online-fix y Remote Play son lo que dispara
  Defender y lo que más rompe. Aislados, la app base sigue compilando y publicándose aunque un
  plugin esté roto.
- **Features verticales espejadas main↔renderer**: `library` en main y `library` en renderer se
  llaman igual y hablan solo por canales `library.*`. Borrar una feature = borrar dos carpetas y
  una sección del contrato. Eso es lo que hace la app "muy fácil de actualizar".

---

## B. Principios anti-deuda (cada uno con su checker en CI)

> Si no se verifica con un comando, no es un principio: es un deseo.

### B.1 — IPC: un router, contrato tipado, allowlist estricta
Existe exactamente **un** `ipcMain.handle`, en `main/ipc/router.ts`.
1. `packages/ipc-contract` declara cada canal con Zod (input + output + `.describe()`).
2. El router valida input → ejecuta handler → valida output → devuelve `Result<T, AppError>`. Nunca lanza al renderer.
3. El preload **genera** una función por canal desde el contrato: `window.ycore.library.launch({ appId })`.
   Si el canal no está en el contrato, la función no existe. Fin del agujero del v1.
4. Eventos main→renderer: mismo patrón, mismo allowlist.

**Checkers:** regla ESLint `no-raw-ipc` (prohíbe `ipcMain.*` / `ipcRenderer.*` fuera de `main/ipc/**` y `preload/**`);
test de contrato bidireccional (todo canal tiene handler, todo handler está en el contrato);
test de arranque que verifica `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

### B.2 — Límite duro de tamaño
400 líneas/archivo, 60 líneas/función, complejidad 12 — todo en nivel `error`.
`eslint-disable` solo con `// JUSTIFICACIÓN:` + entrada en `docs/exceptions.md`, verificado en CI.
→ Un `LibraryPage.tsx` de 1985 líneas es literalmente incommiteable.

### B.3 — Boundaries (quién importa a quién)
```
Permitido:
  renderer/features/*  → su dir, renderer/shared, ipc-contract, ui-kit, i18n, result
  main/features/*      → su dir, main/platform, main/db, core-domain, steam-kit, logger, result
  core-domain          → solo result   (CERO deps externas)
  steam-kit            → core-domain, result
  plugins/*            → ipc-contract, core-domain, result
Prohibido (error):
  renderer → main  |  main → renderer  |  feature A → feature B  |  renderer → node:fs
```
Más `import/no-cycle` en error.

### B.4 — Cero código muerto
**knip** en CI con `--max-issues 0`. Prohibidos los barrels que reexportan todo: cada feature
expone un `index.ts` con su API pública explícita (la regla que el v1 rompió al exportar 14 de 31
servicios). Prohibido código comentado.

### B.5 — Nada de basura en el repo
Hook pre-commit rechaza archivos >5 MB (nunca más un `.exe` de 428 MB).
Prohibido crear `.md` en la raíz salvo `README`, `CONTRIBUTING`, `LICENSE`, `SECURITY`, `CHANGELOG`.
Prohibidos los scripts sueltos: todo va a `tools/scripts/` en TS con header de doc.

### B.6 — Errores y tipos
Prohibido `any` (usa `unknown` + Zod). Prohibido `throw` cruzando fronteras: se devuelve
`Result<T, AppError>`, con `AppError` como unión discriminada (código, clave i18n, `retriable`).

### B.7 — Commits y versiones
Conventional Commits validado por commitlint; scopes = lista cerrada de features/packages.
Todo PR que toque `apps/` o `packages/` requiere changeset; CI falla si falta.

### B.8 — Cobertura mínima por paquete
`core-domain` 90%, `steam-kit` 85%, `updater-client` 85%, features de main 70%, renderer 50%.
Cada bug arreglado exige test de regresión.

### B.9 — Presupuestos
Arranque hasta ventana visible **< 1.5 s** (medido en Playwright en CI).
Instalador **< 120 MB** (el v1 llegaba a 400 con `compression: store`). CI falla si se pasa.

---

## C. Sistema de updates

### C.1 Decisión base
**Se abandona `electron-updater`.** Se escribe `packages/updater-client` propio (~600 líneas).
El v1 ya tuvo que meterle un fallback con `https.get` crudo porque el retry estaba roto; y el modo
mantenimiento, el rollout por porcentaje y las URLs firmadas no encajan sin pelearse con la librería.
Se conserva el formato **NSIS de electron-builder y su blockmap** (para diferencial), pero quien
decide y descarga es código propio.

### C.2 Contrato del endpoint

`GET https://updates.y-core.app/v1/check?version=&channel=&platform=&arch=&clientId=`
Header `X-YCore-Signature: <HMAC del clientId>` (anti-scraping básico).

Solo tres respuestas posibles:

**1. Sin update / mantenimiento** — *indistinguibles a propósito*:
```json
{ "status": "up-to-date", "checkAgainInSeconds": 21600 }
```
> En modo mantenimiento el Worker devuelve exactamente esto. El cliente no puede distinguirlo de
> "estás al día": cero errores, cero popups. Al desactivar el flag, la siguiente comprobación
> devuelve el update con normalidad. Esto es exactamente el comportamiento pedido.

**2. Update disponible**:
```json
{
  "status": "update-available",
  "version": "5.1.0", "channel": "stable", "mandatory": false,
  "notes": { "es": "...", "en": "..." },
  "artifact": { "kind": "nsis", "size": 98123456, "sha512": "...",
                "url": ".../download/5.1.0/full?t=&sig=", "urlExpiresAt": "..." },
  "delta": { "fromVersion": "4.3.12", "blockmapUrl": "...", "estimatedSize": 14200000 },
  "checkAgainInSeconds": 21600
}
```

**3. Kill-switch de versión** (la instalada es tóxica):
```json
{ "status": "blocked", "reason": "critical-bug",
  "message": { "es": "...", "en": "..." }, "forceUpdateTo": { } }
```
El cliente muestra modal no descartable: actualizar o cerrar.

**Regla del cliente:** cualquier respuesta que no valide contra el schema Zod, cualquier error de
red o timeout → se trata como `up-to-date` **en silencio** y se reintenta después.
**El usuario nunca ve un error de update. Nunca.**

### C.3 Estado en Cloudflare

**KV** (`YCORE_CONFIG`, hot path cacheado en edge):
```json
{
  "maintenance": { "enabled": false, "since": null, "note": "" },
  "channels": {
    "stable": { "latest": "5.1.0", "rollout": 100, "minSupported": "4.0.0" },
    "beta":   { "latest": "5.2.0-beta.3", "rollout": 100, "minSupported": "5.0.0" }
  },
  "blocked": { "4.3.11": { "reason": "critical-bug", "forceTo": "5.1.0" } },
  "checkIntervalSeconds": 21600
}
```

**D1** (`ycore_updates`):
```sql
CREATE TABLE releases (
  version TEXT PRIMARY KEY, channel TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'win32', arch TEXT NOT NULL DEFAULT 'x64',
  r2_key TEXT NOT NULL, blockmap_key TEXT,
  size INTEGER NOT NULL, sha512 TEXT NOT NULL, notes_json TEXT NOT NULL,
  mandatory INTEGER NOT NULL DEFAULT 0, rollout INTEGER NOT NULL DEFAULT 100,
  published_at TEXT NOT NULL, yanked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE maintenance_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, enabled INTEGER NOT NULL,
  actor TEXT NOT NULL, note TEXT, at TEXT NOT NULL
);
CREATE TABLE check_stats (   -- agregado, sin PII
  day TEXT, version TEXT, channel TEXT, outcome TEXT, count INTEGER,
  PRIMARY KEY (day, version, channel, outcome)
);
```

**R2** (`ycore-releases`): `releases/<version>/Setup.exe`, `.blockmap`, `manifest.json`.
Bucket **privado**; se sirve solo con URLs firmadas por el Worker, TTL 15 min, HMAC-SHA256 sobre
`key|expiry|clientHash`. Cero enlaces públicos permanentes.

### C.4 Rollout determinista
`bucket = HMAC(clientId + version) mod 100`; recibe el update si `bucket < rollout`.
Determinista: quien ya entró en el 10% no sale al subir a 50%, y no hay flapping.
`rollout: 0` = release publicada pero invisible (para probar con tu propio clientId).

### C.5 Comportamiento del cliente
- Comprueba a los 30 s de arrancar, luego cada `checkAgainInSeconds`, y bajo demanda desde Ajustes.
- **Descarga diferencial** por blockmap + Range requests sobre R2 → ~10-20 MB en vez de 100.
  Si falla, cae a completa. Backoff exponencial con jitter, 5 intentos, reanudable.
- **Verificación obligatoria** antes de ejecutar nada: firma Ed25519 del manifest + SHA512 del archivo.
  Si no cuadra: borrar, telemetría anónima, y callar.
- Instala en background; nunca interrumpe una descarga de juego en curso.
- **En mantenimiento el cliente ni se entera** — no existe estado "en mantenimiento" en el cliente.
  Esa es la clave del diseño.

### C.6 Firma sin certificado de pago
No hay dinero para code-signing, así que se protege la **cadena de actualización**:
1. Par **Ed25519**; la privada solo en GitHub Secrets, nunca en el repo.
2. El pipeline firma el `manifest.json` (versión + sha512 + tamaño).
3. La **pública va embebida en el binario**.
4. El cliente verifica firma del manifest → verifica SHA512 → solo entonces ejecuta.
5. La app acepta 2 claves públicas (actual + siguiente) para rotar sin romper clientes viejos.

→ Aunque secuestren el DNS o el bucket, no pueden hacer que la app instale algo que tú no firmaste.

**Mitigación de Windows Defender (sin certificado):**
`compression: normal` + `differentialPackage: true` (~100 MB en vez de 400 — el tamaño y la
entropía eran parte del problema); envío automático de cada release a **Microsoft Defender
submission** (gratis) desde el pipeline; sacar el FFI/DRM del binario base (es lo que dispara la
heurística); publicar los SHA512 en la landing; ganar reputación SmartScreen publicando siempre
desde el mismo dominio y endpoint.

### C.7 Toggle del dev
CLI en `tools/cli` (`pnpm ycore ...`), autenticada por token, contra `POST /v1/admin/*`:
```
ycore maintenance on --note "migrando R2"     # updates OFF, en silencio
ycore maintenance off | status
ycore release publish --version 5.1.0 --channel stable --rollout 10 --notes-file notes.md
ycore release rollout --version 5.1.0 --to 50
ycore release yank  --version 5.1.0 --reason "crash al iniciar"
ycore release block --version 4.3.11 --force-to 5.1.0
ycore stats --days 7
```
En Fase 7, panel web mínimo en la landing bajo `/admin`, protegido con **Cloudflare Access**
(gratis hasta 50 usuarios), que solo llama a la CLI/API. Todo cambio queda auditado en D1.

---

## D. Protección de código (realista y gratis)

### Lo que SÍ funciona
1. **Mover el valor al servidor** — el 90% de la protección real. Catálogo, reglas de resolución de
   manifests, lógica de la store, validación: todo en el Worker. Un cliente crackeado sin backend
   es un cascarón.
2. **Manifest firmado con Ed25519** (C.6): impide updates falsificados y builds troyanizados.
3. **ASAR integrity** (Electron 33): `EnableEmbeddedAsarIntegrityValidation` + `OnlyLoadAppFromAsar`.
4. **Electron Fuses**: desactivar `RunAsNode`, `EnableNodeCliInspectArguments`,
   `EnableNodeOptionsEnvironmentVariable`. Mata el ataque más fácil que existe contra Electron
   (arrancar tu propio .exe como Node y leerlo todo).
5. **Ofuscación open source selectiva**: `javascript-obfuscator` **solo** en el bundle del main y
   los plugins sensibles (`stringArray`, `controlFlowFlattening: 0.5`). **Nunca en el renderer.**
   Solo en builds de release.
6. **Sourcemaps fuera del paquete** (a bucket privado para debugging).
7. **Rate limiting + HMAC de cliente** en el Worker: encarece scrapear tu API.
8. **Cero secretos en el cliente.** Ninguna API key en el binario.

### Lo que es TEATRO (no hacerlo)
- Detección de debugger en JS — se salta con un breakpoint.
- Ofuscar el renderer — 10x más lento, cero protección (DevTools ve el DOM igual).
- Cifrar el asar con una clave que está en el binario — es ROT13 con pasos extra.
- Comprobar el hash del propio .exe desde el .exe — se parchea el comprobador.
- VMProtect/Themida — cuestan dinero y disparan antivirus.
- Licencias validadas offline — si la validación es local, se parchea.

**A documentar en `docs/06-security/threat-model.md`:** el objetivo no es impedir el crackeo
(imposible en Electron), sino que un cliente crackeado sea **inútil sin el backend**, y que nadie
pueda distribuir una versión troyanizada que se haga pasar por oficial.

---

## E. Documentación y `.claude/`

### E.1 `docs/`
```
docs/
├── README.md                     # índice maestro
├── 00-overview/       vision.md, glossary.md, repo-map.md
├── 01-architecture/   overview.md, ipc-contract.md, boundaries.md,
│                      state-management.md, error-handling.md
├── 02-features/       ← UNA CARPETA POR SECCIÓN
│   └── library/       README.md, data-model.md, ipc-channels.md (generado), ui-flows.md, decisions.md
│       … steam/ downloads/ updates/ settings/ saves/ store/ …
├── 03-services/       update-worker/ (endpoints, KV/D1, runbook)
├── 04-plugins/        plugin-api.md, drm-tools/, online-fix/, remote-play/
├── 05-operations/     release-process.md, maintenance-mode.md, incident-playbook.md, ci-cd.md
├── 06-security/       threat-model.md, code-protection.md, signing.md
├── 07-contributing/   coding-standards.md, how-to-add-a-feature.md ⭐,
│                      how-to-add-an-ipc-channel.md, testing-guide.md, documentation-rules.md
├── adr/               0000-template.md + ADRs numerados
└── exceptions.md      cada eslint-disable con su justificación
```

ADRs iniciales: 0001 monorepo, 0002 contrato IPC único, 0003 abandonar electron-updater,
0004 Cloudflare Worker+R2, 0005 firma Ed25519 sin certificado, 0006 DRM y RemotePlay como plugins,
0007 TanStack Query para datos de IPC.

### E.2 Formato de ADR
Estado / Fecha / Decide / Afecta a — **Contexto** (incluido qué pasó en el v1) — **Decisión** (una
frase, imperativo) — **Alternativas descartadas** (tabla) — **Consecuencias** (positivas, lo que
aceptamos pagar, cómo revertir) — **Cómo se verifica que se cumple** (el comando de lint/test).

**Un ADR aceptado es inmutable.** Si cambias de idea, escribes uno nuevo que reemplaza al anterior.
Eso es lo que evita los 90 `.md` contradictorios del v1.

### E.3 `.claude/` — el sistema inmune

**`.claude/CLAUDE.md`** (contenido concreto):
- Hablar siempre en español informal. Closed-source, sin presupuesto, Windows-only, prioridad #1 cero deuda.
- Antes de escribir código: leer `how-to-add-a-feature.md`; si hay decisión de arquitectura,
  escribir primero el ADR; si toca IPC, leer `how-to-add-an-ipc-channel.md`.
- **Reglas inviolables** (rompen el build): un solo `ipcMain.handle`; preload nunca expone `invoke()`
  genérico; 400 líneas/archivo y 60/función; prohibido `any`; prohibido `throw` cruzando fronteras;
  prohibido `.md` en la raíz; prohibidos scripts sueltos; prohibido importar entre features;
  prohibido meter datos del main en zustand; `eslint-disable` solo con justificación documentada;
  prohibido commitear >5 MB.
- **Regla de documentación obligatoria:** toda función/módulo/canal público nuevo lleva TSDoc
  (qué hace, params, returns, errores, `@example`); feature nueva → `docs/02-features/<x>/README.md`;
  canal nuevo → `.describe()` de Zod siempre (la doc se genera de ahí); carpeta nueva → actualizar
  `repo-map.md`; siempre añadir changeset.
- **Definición de HECHO:** `pnpm lint && typecheck && test && knip && check:docs && check:contract`.
- **Lo que no se hace aquí:** reintroducir electron-updater; crear un "V2" de un store existente;
  dejar código comentado; escribir informes de auditoría en `.md` (se abre un issue).

**`.claude/agents/`**: `arquitecto` (solo diseña y escribe ADRs, read-only) · `documentador`
(genera/actualiza docs y TSDoc del diff) · `guardian-contrato` (revisa que todo canal nuevo tenga
Zod con `.describe()`, handler, test y doc) · `revisor-deuda` (knip/boundaries/max-lines sobre el
diff, propone divisiones antes de que los archivos crezcan).

**`.claude/skills/`**: `nueva-feature` (ADR → scaffolding vertical main+renderer → canales →
tests → docs → changeset) · `nuevo-canal-ipc` · `nuevo-adr` · `release`.

**`.claude/hooks/`** — esto es lo que hace la documentación *obligatoria* y no opcional:
1. `PostToolUse` en Write|Edit → `check-file-rules.ts`: bloquea >400 líneas, `.md` en raíz,
   `ipcMain.handle` fuera del router, export público sin TSDoc.
2. `PostToolUse` en Write bajo `features/` → `require-feature-doc.ts`: exige
   `docs/02-features/<feature>/README.md` antes de seguir.
3. `Stop` → `check-done.ts`: corre `check:docs` + `check:contract`; si falta algo, no deja cerrar
   la tarea y lista qué falta documentar.
4. `PreToolUse` en Bash → bloquea `git commit` sin changeset o con archivos >5 MB staged.
5. `SessionStart` → resumen: features documentadas vs no, deuda detectada por knip.

**`pnpm check:docs`** (`tools/scripts/check-docs.ts`): recorre `main/features/*` y
`renderer/features/*` y verifica que cada una tenga su carpeta en `docs/02-features/` con README
no vacío y actualizado. Falla en CI. **Es la pieza que garantiza que cada función nueva queda documentada.**

---

## F. Fases

Esfuerzo en puntos (1 pto ≈ una sesión enfocada). Total ≈ **100 pts**.

### Fase 0 — Bootstrap: repo, tooling y sistema de documentación — *8 pts*
Repo privado, `main` protegida, PRs obligatorios. pnpm + Turborepo + configs compartidas.
`apps/desktop` con electron-vite abriendo una ventana vacía. `packages/result` y `packages/logger`
(los más pequeños, sirven de plantilla de "cómo se hace un package aquí"). ESLint con boundaries,
max-lines, no-any, no-raw-ipc. knip, commitlint, changesets, lefthook. CI verde.
**`.claude/` completo** (CLAUDE.md + 4 agentes + 4 skills + 5 hooks + checkers).
**`docs/` completo con esqueleto**, plantilla ADR, ADR-0001/0002 y `how-to-add-a-feature.md` escritos.
`apps/web-landing` desplegada en Cloudflare Pages.

**HECHO cuando:** el pipeline completo está verde; crear a propósito un archivo de 500 líneas es
**bloqueado**; escribir `ipcMain.handle` fuera del router es **bloqueado**; la landing es visitable.

> Orden crítico dentro de F0: **`.claude/` y `docs/` se crean ANTES del primer archivo de `apps/desktop`.**
> Si las reglas existen antes que el código, no hay deuda que limpiar después.

### Fase 1 — Núcleo: contrato IPC, router, preload seguro, DB — *10 pts*
`packages/ipc-contract` + generador del allowlist. `main/ipc/router.ts` (el único handle) + registry
+ Zod + `Result`. Preload con contextBridge, sandbox on, **sin invoke genérico**. Electron Fuses +
ASAR integrity desde el día 1. `main/db` con Drizzle, migraciones y backup automático.
`packages/i18n` (6 idiomas + typecheck de claves). `ui-kit` con tokens y primitivos — Tailwind 4,
cero CSS a mano. TanStack Router + Query configurados.

**HECHO cuando:** test de contrato bidireccional pasa; `window.ycore.invoke` es `undefined` y
llamar a un canal inexistente es imposible en tipos y en runtime; migración de DB aplicable y
revertible en test; `ipc-contract.md` y ADR-0002 completos.

### Fase 2 — Feature Biblioteca (vertical completa) — *12 pts*
El **molde canónico** de todas las features. `main/features/library` (repositorio Drizzle, servicio,
handlers); `core-domain` con `Game`/`Installation`/`LaunchOptions` puros; renderer con grid
virtualizado, filtros, búsqueda fuse.js, detalle, caché de portadas en disco; zustand solo para UI,
datos por TanStack Query; lanzamiento + tracking de tiempo jugado.

**HECHO cuando:** ningún archivo >400 líneas (contraste directo con las 1985 del v1);
10.000 juegos falsos renderizan a 60 fps; `docs/02-features/library/` completo; `core-domain` ≥90%.

### Fase 3 — Integración Steam — *12 pts*
`packages/steam-kit`: parser VDF, `libraryfolders.vdf`, `appmanifest_*.acf`, depots, rutas — puro y
testeado contra fixtures reales portados del v1. `main/features/steam`: detección por registro de
Windows, watcher con chokidar, sincronización con la DB, resolución de rutas. Importación de la
biblioteca real.

**HECHO cuando:** ≥30 fixtures ACF/VDF reales en la suite, incluidos los casos raros que rompieron
el v1; `steam-kit` no importa Electron ni `node:fs` (recibe contenido, no rutas).

### Fase 4 — Motor de descargas — *14 pts*
**Un solo motor** (nada de `useDownloadQueueStore` + `useDownloadEngineV3Store`). Máquina de estados
explícita y documentada: `queued → downloading → verifying → extracting → installing → done|failed|paused`.
Descargas segmentadas y reanudables (Range), límite de ancho de banda, verificación de integridad,
extracción, cola persistida en DB, eventos de progreso throttled a 4/s (no 60/s).

**HECHO cuando:** matar el proceso a mitad de descarga y reabrir → reanuda donde iba; cero descargas
duplicadas concurrentes; un solo store de descargas en el repo; diagrama de la máquina de estados en docs.

### Fase 5 — Sistema de updates completo — *12 pts*
`services/update-worker` (`/v1/check`, `/v1/download`, `/v1/admin/*`, KV+D1+R2, URLs firmadas).
`packages/updater-client` (check, rollout determinista, diferencial por blockmap, verificación
SHA512+Ed25519, backoff, silencio total ante errores). `renderer/features/updates` (banner discreto,
notas, "reiniciar para actualizar", modal de kill-switch). `tools/cli`. `release-desktop.yml`
(build → firma manifest → R2 → D1 → rollout inicial 10%). `electron-builder.yml` con
`compression: normal` y `differentialPackage: true`.

**HECHO cuando:** e2e real — instalar 5.0.0, publicar 5.0.1, la app se actualiza sola;
`ycore maintenance on` → el cliente deja de ver updates **sin ningún error ni popup**, `off` → vuelve
(verificado en la app real, no solo en tests); manifest con firma inválida es rechazado;
instalador <120 MB y update diferencial <25 MB; ADRs 0003/0004/0005 y el runbook escritos.

> **Aquí la app ya es usable y publicable.** Biblioteca + Steam + descargas + updates.
> Todo lo demás es incremento.

### Fase 6 — Ajustes, saves, Discord RPC, pulido — *8 pts*
Settings tipados con Zod y migración de esquema; backup/restauración de partidas con versionado;
Discord RPC aislado y opcional (degrada en silencio si no está Discord); onboarding, bandeja,
atajos globales; accesibilidad e i18n completos.
**HECHO cuando:** 6 idiomas sin claves faltantes (checker en CI); backup/restore en e2e;
arranque <1.5 s medido en CI.

### Fase 7 — Arquitectura de plugins + panel admin — *10 pts*
`plugin-api.md` (manifest, permisos declarados, canales, ciclo de vida). Cargador con descubrimiento,
validación de firma, aislamiento en **utility process** (no en el main) y permisos explícitos.
Namespaces `plugin:<id>.<canal>` con el mismo allowlist. Página de plugins. Panel admin del update
service tras Cloudflare Access.
**HECHO cuando:** un `hello-plugin` se carga, registra un canal, se desactiva y descarga limpiamente;
un plugin que crashea **no tumba la app**.

### Fase 8 — Plugin `drm-tools` — *10 pts*
Port del FFI koffi tras una interfaz limpia y testeable, en utility process aislado (si el FFI
revienta, muere el proceso, no la app). Detección de protecciones y estrategias con fallback
(la lógica del v1 es lo que vale de ese código). DLLs verificadas por hash desde R2.
**HECHO cuando:** crash del proceso nativo no afecta a la app; toda ruta de fallback tiene test.

### Fase 9 — Plugin `online-fix` — *6 pts*
Aplicación de fixes multijugador, catálogo servido por el Worker (valor en el servidor, sección D),
rollback limpio de cualquier fix aplicado.

### Fase 10 — Plugin `remote-play` (WebRTC + Android) — *14 pts*
La más grande y arriesgada, por eso va última. Señalización en Worker con Durable Objects, captura
y encoding, input remoto, cliente Android.
**HECHO cuando:** sesión estable 30 min a 1080p60 en LAN; la app base sigue funcionando con el
plugin desactivado o roto.

### Fase 11 — Store interna, workshop/mods — *8 pts*
Backend en Worker, cliente delgado. Mods con verificación de integridad y desinstalación limpia
(el v1 tenía 12 `.md` sobre esto; ahora será un solo `docs/02-features/mods/`).

### Orden
```
F0 → F1 → F2 → F3 → F4 ─┐
                        ├→ F5 (updates) ── PRIMERA RELEASE PÚBLICA
                        └→ F6 (pulido)
                              ↓
                             F7 (plugins) ─→ F8 drm · F9 online-fix · F10 remote-play · F11 store/mods
```
F5 puede empezarse en paralelo a F3/F4: el Worker es independiente de la app.

---

## G. Qué se porta y qué se tira

### Se porta (reescrito + testeado, nunca copy-paste)
| Del v1 | Destino | Por qué vale |
|---|---|---|
| Parsers VDF / ACF / appmanifest + sus fixtures + `check-acf-contract` | `packages/steam-kit` | Años de casos raros resueltos. Es conocimiento, no código. |
| Resolución de depots y rutas de librerías Steam | `packages/steam-kit` | Idem |
| Detección de protecciones DRM y estrategias de fallback | `plugins/drm-tools` | El algoritmo es el valor; el andamiaje FFI se reescribe |
| Vtables/offsets nativos y `audit-vtables` | `plugins/drm-tools` | Datos duros de ingeniería inversa |
| Catálogo de juegos + `sync-catalog` | Worker + D1 | Se mueve al servidor (sección D) |
| Traducciones de los 6 idiomas | `packages/i18n` | Se reaprovechan cadenas, se reorganizan claves |
| Señalización WebRTC y protocolo Android | `plugins/remote-play`, `apps/android` | Funciona; el transporte se moderniza |
| UX que funcionaba | `docs/02-features/*/ui-flows.md` | Se documenta antes de reimplementar |

### Se tira sin piedad
Los 167 `ipcMain.handle` y el gateway a medias · el `invoke()` genérico del preload (jamás vuelve) ·
los 4 stores duplicados · `LibraryPage.tsx` (1985 líneas) y todo componente monolítico ·
`index.css` (1349 líneas) · los ~90 `.md` de la raíz (se leen una vez para extraer conocimiento a
`docs/`, **ninguno se copia**) · los 14 `_patch_*.cjs` / `_fix_*.mjs` · el `.exe` de 428 MB,
`dist/`, `release/`, `asar-extract*`, `test-output.log`, `nul`, `graphify-out/` · `electron-updater`
y su fallback casero · los 3 tsconfig sueltos y `vite-plugin-electron` · el barrel que exporta 14 de
31 servicios · `package-lock.json` coexistiendo con pnpm-lock · la licencia MIT declarada en un
proyecto closed-source → `UNLICENSED`.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Fatiga: 83k líneas es mucho, se abandona a mitad | El orden entrega app usable en F5; lo caro (DRM, RemotePlay) es opcional y posterior |
| Las reglas duras frenan tanto que se desactivan | Los números se ajustan en F0-F2, cuando hay poco código. Después son inmutables y toda excepción queda en `docs/exceptions.md` |
| Defender sigue bloqueando | Instaladores más chicos, DRM fuera del binario base, submissions automatizadas, hashes publicados (ADR-0005) |
| Free tier de Cloudflare insuficiente | Hot path en KV (100k lecturas/día) con caché de 6 h por cliente; R2 10 GB con purga automática dejando las 3 últimas releases por canal |
| Perder conocimiento del v1 | El repo viejo se **archiva, no se borra**; F3 y F8 empiezan leyéndolo como referencia y portando fixtures y tests primero |

---

## Verificación

**De este roadmap** (Fase 0): el criterio es que las reglas *muerdan*. Tras F0 hay que comprobar a
mano que el repo rechaza lo que debe rechazar:
1. `pnpm lint && pnpm typecheck && pnpm test && pnpm knip && pnpm check:docs` → verde.
2. Crear un archivo de 500 líneas → el hook lo bloquea.
3. Escribir `ipcMain.handle` en una feature → ESLint falla el build.
4. Intentar commitear un archivo de 10 MB → el pre-commit lo rechaza.
5. Crear una feature sin su `docs/02-features/<x>/README.md` → el hook `Stop` no deja cerrar la tarea.
6. La landing responde en su dominio de Cloudflare Pages.

**Del sistema de updates** (Fase 5), end-to-end con binarios reales, no solo tests:
1. Instalar 5.0.0, publicar 5.0.1 con `ycore release publish --rollout 100` → la app se actualiza sola.
2. `ycore maintenance on` → reiniciar el cliente → **no aparece ningún update, ningún error, ningún popup**.
3. `ycore maintenance off` → siguiente comprobación → el update vuelve a aparecer.
4. `ycore release block --version 5.0.0 --force-to 5.0.1` → el cliente en 5.0.0 muestra el modal no descartable.
5. Manipular a mano el sha512 en D1 → el cliente rechaza la descarga y no ejecuta nada.
6. Medir el update diferencial: debe ser <25 MB frente a los ~400 MB del v1.
