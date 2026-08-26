# ADR-0005: Construir el update-worker como Worker nativo, con el contrato Zod compartido y la firma fuera del Worker

- **Estado**: Aceptado
- **Fecha**: 2026-08-26
- **Decide**: @yummancito
- **Afecta a**: `services/update-worker`, `packages/update-contract`, `packages/updater-client`,
  `packages/eslint-config`, `packages/tsconfig`, `tools/cli`,
  `.github/workflows/release-desktop.yml`, `.github/workflows/deploy-worker.yml`,
  `docs/03-services/update-worker`

## Contexto

El ADR-0003 ya decidió **el cliente**: se abandona `electron-updater` y `packages/updater-client`
habla con un endpoint controlado. Lo que el 0003 dejó abierto a propósito es **el endpoint**. Este
ADR lo cierra. **No reemplaza al 0003: lo complementa.** El 0003 sigue mandando sobre el
comportamiento del cliente (silencio ante errores, tres respuestas, verificación Ed25519 + SHA512).

Lo que el roadmap ya fija y aquí no se re-discute (secciones C.2 a C.7):

- El contrato de `GET /v1/check` con exactamente tres respuestas: `up-to-date`,
  `update-available`, `blocked`.
- El estado repartido en **KV** (`YCORE_CONFIG`: maintenance, channels, blocked,
  checkIntervalSeconds), **D1** (`releases`, `maintenance_log`, `check_stats`) y **R2**
  (`ycore-releases`, privado, servido con URLs firmadas de 15 min).
- Rollout determinista: `bucket = HMAC(clientId + version) mod 100`, entra si `bucket < rollout`.
- Firma Ed25519 del manifest, con la privada **solo en GitHub Secrets** (C.6.1).
- CLI `ycore` contra `POST /v1/admin/*`, autenticada por token, con auditoría en D1.

Restricciones que condicionan todo lo de abajo, y que son las que de verdad deciden:

- **Presupuesto 0 €.** Cloudflare free tier es el techo: Workers 100k req/día, KV 100k
  lecturas/día, D1 5 GB y 5 M lecturas de fila/día, R2 10 GB con **egress gratis** (por eso R2 y
  no S3). Nada de plan mínimo, nada de SaaS de observabilidad.
- **Cero deuda técnica sobre velocidad.** El Worker es la pieza que, si se rompe, rompe las
  actualizaciones de todos los usuarios a la vez. Es el único componente del proyecto sin
  rollback local.
- **El runtime NO es Node.** `workerd` no tiene `node:fs`, ni `node:child_process`, ni
  `better-sqlite3`, ni Drizzle contra SQLite local. Tiene Web Crypto, `fetch`, `Request`/`Response`
  y los bindings. Cualquier config compartida que asuma Node está mal aquí.
- **Estado del repo hoy**: `pnpm-workspace.yaml` ya declara `services/*`, pero `services/` está
  vacío y `docs/03-services/` también — aunque `docs/README.md` ya enlaza
  `03-services/update-worker/`. Ese enlace roto se arregla con este trabajo.

### Las cicatrices del v1 que aplican aquí

- **Los binarios eran públicos** en GitHub Releases: cualquiera se bajaba el `.exe` sin pasar por
  la app, y no había forma de retirar una versión rota.
- **Dos caminos de actualización conviviendo** (`electron-updater` + `app:manualDownloadUpdate`
  con `https.get` crudo), con canales IPC inconsistentes entre ellos. El equivalente de ese
  fallo en el servidor sería tener dos formas de decidir qué versión toca; hay que impedirlo por
  construcción.
- **Cero observabilidad de quién recibía qué.** No se podía responder "¿cuántos clientes están en
  4.3.11?". De ahí `check_stats`, agregado y sin PII.

### Frontera: qué es y qué no es este servicio

El update-worker sirve **actualizaciones de la propia app**. No sirve juegos, no resuelve
catálogos, no es el backend de la store (Fase 11) ni el de señalización WebRTC (Fase 10). El
ADR-0004 ya dejó escrito que la Fase 5 "es solo para actualizaciones de la app, no para juegos".
Si en Fase 9/11 hace falta un backend de catálogo, es **otro Worker** con su propio ADR, no un
grupo de rutas más aquí. Meter todo en un Worker es la versión servidor de los 167
`ipcMain.handle` del v1.

## Decisión

Se construye `services/update-worker` como **Worker nativo sin framework de routing**, con el
contrato compartido en un paquete Zod nuevo (`packages/update-contract`), **HTTP como lenguaje de
error hacia fuera y `Result` hacia dentro**, y la **firma Ed25519 hecha en el pipeline de CI,
nunca en el Worker**. Todo lo testeable se testea local con `vitest-pool-workers` sobre Miniflare,
sin cuenta de Cloudflare.

Los ocho puntos, cerrados:

### 1. Router: `fetch` handler nativo con una tabla de rutas. Cero framework

Nada de Hono ni itty-router. El Worker exporta un `export default { fetch }` y despacha con una
**tabla constante** `ROUTES: ReadonlyArray<Route>` donde cada entrada es
`{ method, path, handler }`, resuelta con `URLPattern` (disponible en `workerd`) o con
comparación exacta de `pathname`. Son **cinco rutas en total**:

```
GET  /v1/check
GET  /v1/download/:version/:kind      (kind: full | blockmap)
POST /v1/admin/maintenance
POST /v1/admin/release
GET  /v1/admin/stats
```

Cinco rutas no justifican una dependencia. Es exactamente el criterio con el que el ADR-0004
descartó `got`/`axios` a favor de `undici` global: **la solución mínima del propio runtime
alcanza**. Y aquí pesa además que el bundle del Worker tiene un límite duro de 3 MB comprimido en
el free tier y que cada dependencia es superficie de supply-chain en el componente que firma y
sirve binarios ejecutables a todos los usuarios.

Lo que sí se escribe a mano y hay que asumir: parseo de query params (`URL.searchParams`, ya lo da
el runtime), matching de método+path (la tabla), y un `404` por defecto. Son ~60 líneas.

**Regla dura**: existe **un solo `export default { fetch }`** en todo `services/update-worker`, y
un solo punto de despacho. Es el mismo principio que el `ipcMain.handle` único de B.1, aplicado al
servidor. Con checker (ver abajo).

### 2. Testing local: `vitest-pool-workers` sobre Miniflare, cero cuenta de Cloudflare

Se usa **`@cloudflare/vitest-pool-workers`**, que ejecuta los tests **dentro de `workerd` real**
(el mismo binario que en producción, no una emulación en Node) con Miniflare proveyendo los
bindings. Viene con `wrangler`, que ya hace falta igualmente para desplegar: **cero dependencias
adicionales más allá de las de desarrollo del propio servicio**.

Lo que da Miniflare de verdad, no simulado a medias:

- **KV**: almacenamiento local persistente en `.wrangler/state`. Se puede sembrar
  `YCORE_CONFIG` en el `beforeEach` de cada test.
- **D1**: **SQLite real** por debajo. Las migraciones se aplican de verdad, las constraints
  muerden de verdad. Es el mismo criterio que el ADR-0004 aplicó a `openInMemoryDb`: se testea
  contra la DB real, no contra un doble.
- **R2**: bucket local real. Se sube un `Setup.exe` de 12 bytes de fixture y se comprueba que la
  URL firmada lo devuelve.
- **Aislamiento por test** con `isolatedStorage: true`: cada test arranca con el estado limpio y
  no se contaminan entre sí.

Se testea **100% local**, sin cuenta: routing, validación de input, rollout determinista (incluidos
los bordes `rollout: 0` y `rollout: 100`), modo mantenimiento, kill-switch, verificación del HMAC
`X-YCore-Signature`, generación y expiración de URLs firmadas, auth de los endpoints admin,
escritura en `maintenance_log` y agregación en `check_stats`, y las migraciones D1.

**Requiere cuenta real, y por tanto NO es test sino verificación manual documentada** en
`docs/05-operations/release-process.md`: el `wrangler deploy`, el DNS de `updates.y-core.app`, el
comportamiento del caché del edge, los límites reales del free tier, y el e2e con binarios de
verdad (los 6 pasos de la sección "Verificación" del roadmap). **Nada de eso entra en `pnpm test`**:
un test que necesita credenciales es un test que falla en el PR de un lunes cualquiera.

`wrangler dev --local` sirve para desarrollo interactivo y para probar la CLI `ycore` contra un
Worker local. No es parte del checker.

### 3. Estructura, migraciones en SQL crudo y `packages/update-contract`

```
services/update-worker/
├── wrangler.jsonc                # bindings: KV YCORE_CONFIG, D1 ycore_updates, R2 ycore-releases
├── package.json                  # scripts: dev, test, lint, typecheck, deploy
├── tsconfig.json                 # extiende @ycore/tsconfig/base + lib DOM-ish de workers
├── vitest.config.ts              # defineWorkersConfig, isolatedStorage
├── migrations/
│   ├── 0001_initial.sql          # releases, maintenance_log, check_stats (C.3 del roadmap)
│   └── ...                       # numeradas, append-only, nunca se editan
└── src/
    ├── index.ts                  # ÚNICO export default { fetch } + tabla ROUTES. <100 líneas
    ├── env.ts                    # tipo Env de los bindings, y nada más
    ├── routes/
    │   ├── check.ts              # GET /v1/check
    │   ├── download.ts           # GET /v1/download/:version/:kind
    │   └── admin/{maintenance.ts, release.ts, stats.ts}
    ├── domain/                   # PURO, sin bindings, sin fetch: lo interesante de testear
    │   ├── rollout.ts            # bucket = HMAC(clientId+version) mod 100
    │   ├── decide.ts             # (config, release, clientId) -> up-to-date|update-available|blocked
    │   └── signed-url.ts         # construcción y validación del HMAC de las URLs de R2
    ├── data/
    │   ├── config-kv.ts          # lectura/escritura de YCORE_CONFIG, con Zod al leer
    │   ├── releases-d1.ts
    │   └── stats-d1.ts
    └── http/
        ├── responses.ts          # json(), noContent(), problem()
        └── auth.ts               # bearer del admin + HMAC del cliente
```

Tres decisiones dentro de esta estructura:

**a) Migraciones D1 en SQL crudo numerado, no Drizzle.** `apps/desktop` usa Drizzle porque tiene
`better-sqlite3` y un esquema que evoluciona con la app. Aquí el esquema son **tres tablas que ya
están escritas literalmente en el roadmap** y que no van a moverse; `wrangler d1 migrations apply`
ya gestiona el versionado y el registro de aplicadas; y meter Drizzle significa meter su driver D1,
su generador y su config en un runtime donde el ORM no aporta ni tipado de más valor que el que
da Zod al parsear el resultado. **Se usa `d1.prepare(...).bind(...)` con statements parametrizados
siempre** (nunca concatenación de strings: es la única superficie de inyección del servicio) y el
resultado se parsea con Zod antes de tocarlo. El precio que se paga está listado en Consecuencias.

**b) Se crea `packages/update-contract`**, no se duplica el tipo en cada lado ni se acoplan "por
el JSON documentado". Es exactamente el argumento de A.3 del roadmap para `ipc-contract`: la única
forma de que dos artefactos compilados por separado compartan **la misma verdad** es un paquete que
ambos importan; si cada lado define su tipo, divergen en la primera prisa y el fallo se ve en
producción, en el componente que actualiza a todo el mundo. El paquete contiene **solo schemas Zod
v4 y los tipos inferidos** — cero I/O, cero dependencias más allá de `zod`:
`CheckRequestSchema`, `CheckResponseSchema` (unión discriminada por `status`), `ManifestSchema`,
`AdminMaintenanceSchema`, `AdminReleaseSchema`. Todos con `.describe()` en cada campo, como manda
la regla de documentación para canales.

El Worker valida su **input** con estos schemas; `updater-client` valida su **respuesta** con los
mismos. Ese es el punto: el "cualquier respuesta que no valide contra el schema Zod se trata como
up-to-date en silencio" del ADR-0003 solo tiene sentido si el schema es literalmente el mismo
objeto que el Worker usó para producirla.

**No se llama `packages/ipc-contract` ni se mete dentro de él**: el contrato IPC es la frontera
main↔renderer y el Worker no la cruza. Son dos fronteras distintas y mezclarlas haría que el
renderer pudiera importar schemas del backend.

**c) `packages/update-contract` se declara en `boundariesSettings`** como tipo
`update-contract`, con la matriz: `update-worker → update-contract, result` y
`updater-client → update-contract, result`. Sin esa entrada, `boundaries/no-unknown` (que está en
`error`) empieza a fallar en cuanto aparece el primer archivo bajo `services/`.

### 4. Errores: HTTP hacia fuera, `Result` hacia dentro

**Hacia el cliente público**: códigos de estado HTTP + body mínimo. Nada de `Result` serializado.
Un `Result<T, AppError>` en el body obligaría a `updater-client` a distinguir "200 con `ok: false`"
de "500", que es **más** superficie de decisión en el componente cuyo diseño explícito (ADR-0003)
es "todo lo que no sea una respuesta válida es up-to-date, en silencio". Añadir estructura de error
a algo que el cliente va a ignorar por diseño es escribir código muerto por contrato.

| Situación | Respuesta |
|---|---|
| `/v1/check` correcto (incluido mantenimiento) | `200` + el JSON de C.2 |
| `/v1/check` con params inválidos o HMAC malo | `200` + `{"status":"up-to-date","checkAgainInSeconds":21600}` |
| `/v1/download` con firma inválida o expirada | `403`, body vacío |
| Admin sin token o con token malo | `401`, body vacío |
| Admin con payload inválido | `400` + `{"error":"<código>","detail":"<mensaje>"}` |
| Ruta desconocida | `404`, body vacío |
| Bug no controlado | `500`, body vacío, y log estructurado |

Ese `200` ante input inválido en `/v1/check` es deliberado: **al cliente no le sirve saberlo** (por
el ADR-0003 se comportaría igual) y a un scraper sí le sirve, porque un `400` le dice que el
parámetro que probó tiene la forma correcta y el otro no. El intento inválido sí se cuenta en
`check_stats` con `outcome = 'rejected'` para que quede visible en `ycore stats`.

**Hacia dentro**: `Result<T, AppError>` de `@ycore/result`, igual que en el resto del repo. La regla
"prohibido `throw` cruzando fronteras" **sigue aplicando**, porque las fronteras aquí son las
mismas de siempre: `data/*.ts` habla con KV/D1/R2 (terceros que lanzan) y devuelve `Result`;
`domain/*.ts` es puro y devuelve `Result`; **solo `routes/*.ts` traduce ese `Result` al `Response`
HTTP**, en un único punto por ruta. `@ycore/result` es TypeScript puro sin dependencias de Node:
funciona en `workerd` sin tocar nada. Se añaden los códigos `AppErrorCode` que falten
(`update.unknown-version`, `update.signature-invalid`, `update.unauthorized`) al enum de
`packages/result`.

Un `try/catch` que envuelva el `fetch` entero, con `fromUnknown` y un `500` opaco, es la última red:
un bug nunca puede devolver un stack trace al cliente.

### 5. La clave privada Ed25519 **nunca entra en el Worker**. Firma el pipeline

**El Worker no firma nada. No conoce la clave privada. No hay `wrangler secret put` de la clave
privada.**

El flujo exacto, en `release-desktop.yml` (disparado por tag `v*`):

1. Build de Windows con electron-builder → `Setup.exe` + `.blockmap`.
2. Se calcula `sha512` y `size` del artefacto.
3. Se compone `manifest.json` (version, channel, sha512, size, blockmap sha512, notes).
4. **Se firma el manifest ahí mismo**, con la privada leída de `secrets.YCORE_SIGNING_KEY`, por un
   script de `tools/scripts/` (Node + `node:crypto`, que tiene Ed25519 nativo: cero dependencias).
5. Se suben `Setup.exe`, `.blockmap` y `manifest.json` **ya firmado** a R2.
6. Se llama a `POST /v1/admin/release` con el token de admin, que inserta la fila en `releases`
   y actualiza `channels.stable.latest` en KV con `rollout: 10`.

El Worker **almacena y sirve** el manifest firmado; jamás lo reconstruye ni lo re-firma. Si lo
firmara el Worker, la clave privada viviría en un secret de Cloudflare y **cualquiera con acceso a
la cuenta de Cloudflare, o cualquier RCE en el Worker, podría firmar un binario arbitrario** — que
es literalmente la amenaza contra la que existe la firma (C.6: "aunque secuestren el DNS o el
bucket, no pueden hacer que la app instale algo que tú no firmaste"). Con la firma en CI, Cloudflare
es infraestructura **no confiable por diseño**: puede servir bytes, no puede autorizarlos.

Consecuencia directa, y es la buena: **`ycore release publish` desde el portátil no puede firmar**.
Publicar una release es siempre un tag de git que dispara el workflow. La CLI sirve para
`rollout`, `yank`, `block`, `maintenance` y `stats` — operaciones que no producen artefactos
firmados. Si algún día hiciera falta publicar a mano, es un job manual de GitHub Actions
(`workflow_dispatch`), no una clave en un disco.

**Rotación** (C.6.5): el cliente acepta dos públicas embebidas. Rotar es añadir la nueva a
`packages/updater-client`, publicar una versión de la app que la acepte, esperar a que se propague,
y solo entonces cambiar `YCORE_SIGNING_KEY` en GitHub Secrets. El Worker no participa.

### 6. HMAC anti-scraping: secreto compartido embebido, `clientId` local y estable

`X-YCore-Signature: hex(HMAC-SHA256(YCORE_CLIENT_SECRET, clientId + version + channel))`.

- **`clientId`**: UUID v4 generado en el **primer arranque** de la app y persistido en la DB local
  (tabla `settings`). No deriva de nada del hardware ni del usuario: **no es un identificador de
  persona, es un número de rifa para el rollout**. Debe ser estable, porque si cambiara, un cliente
  entraría y saldría del rollout en cada arranque y aparecería el flapping que C.4 quiere evitar.
  El Worker **no lo guarda**: `check_stats` es agregado por `(day, version, channel, outcome)`, sin
  columna de cliente. Cero PII, ni siquiera pseudónima.
- **El secreto compartido está embebido en el binario de la app**, y en un secret del Worker
  (`wrangler secret put YCORE_CLIENT_SECRET`). En el Worker es un secret de verdad; en el cliente
  es, seamos honestos, **ofuscación**: cualquiera que desensamble el `.exe` lo extrae. Y está bien,
  porque **su objetivo no es autenticación**: es que un scraper trivial (`curl` en bucle sobre
  `/v1/check`) no funcione sin haber mirado dentro del binario. Eso solo es aceptable porque **la
  seguridad real es la firma Ed25519 del punto 5**, que no depende de este secreto en absoluto.
  Registrarlo así, explícitamente, es lo que evita que alguien construya encima de él asumiendo que
  protege algo. Va a `docs/06-security/threat-model.md` en la columna de "mitigación parcial", no
  en la de "protegido". Rotarlo obliga a publicar una versión de la app, así que se rota solo si
  aparece scraping real.
- **HMAC inválido → `200` up-to-date**, nunca `403` (punto 4). Un `403` es la señal que le dice al
  scraper que va por buen camino.
- Se compara con **comparación en tiempo constante** (`crypto.subtle.verify` de HMAC, que ya lo es;
  nunca `===` sobre el hex).

### 7. `/v1/check` trae la URL firmada ya lista. `/v1/download` es quien la valida

Son dos cosas distintas y el roadmap las mezclaba:

- **`/v1/check` devuelve `artifact.url` ya firmada** (`/v1/download/5.1.0/full?t=<expiry>&sig=<hmac>`)
  junto con `urlExpiresAt`. El cliente **no llama a un endpoint intermedio**: eso sería una
  request de más, un fallo de red de más y un estado de más en el cliente, para no ganar nada.
  El JSON de ejemplo de C.2 ya lo muestra así (`"url": ".../download/5.1.0/full?t=&sig="`).
- **`/v1/download/:version/:kind` es quien valida esa firma** (`HMAC-SHA256` sobre
  `key|expiry|clientHash`, TTL 15 min) y, si es válida, **hace streaming del objeto de R2**
  (`env.RELEASES.get(key)` y devolver su `body` en la `Response`, con `Range` pasado a través para
  que la descarga diferencial por blockmap del ADR-0003 funcione). **No redirige** a una URL
  pública de R2: el bucket es privado y no hay enlaces públicos permanentes (C.3). El egress de R2
  es gratis, así que hacer proxy no cuesta dinero.
- `kind` es `full` o `blockmap`, y `blockmapUrl` del bloque `delta` se firma igual.
- Si la firma expiró: `403`. El cliente vuelve a llamar a `/v1/check`, que es barato y le da una
  URL nueva. 15 minutos es suficiente para empezar la descarga; una descarga ya empezada no se
  interrumpe porque la firma se valida al abrir la conexión, no continuamente.

### 8. Qué se testea con Miniflare y qué es verificación manual

**En `pnpm test` (local, sin cuenta, obligatorio en cada PR):**

- **Rollout determinista**: el mismo `clientId` + `version` da siempre el mismo bucket; subir
  `rollout` de 10 a 50 **nunca saca** a quien ya estaba dentro (test sobre 1000 clientIds
  sintéticos comprobando que el conjunto incluido en 10 es subconjunto del incluido en 50);
  `rollout: 0` no incluye a nadie; `rollout: 100` incluye a todos.
- **Modo mantenimiento**: con `maintenance.enabled = true` en KV, la respuesta es
  **byte a byte idéntica** a la de un cliente al día. Este test es el que protege el corazón del
  ADR-0003 y no puede faltar.
- **Kill-switch**: cliente en una versión de `blocked` recibe `status: "blocked"` con `forceUpdateTo`,
  **incluso en modo mantenimiento** (decisión: el bloqueo pesa más que el mantenimiento; un
  binario tóxico sigue siendo tóxico mientras migras R2).
- **HMAC del cliente**: firma correcta pasa; firma alterada en un byte responde `200` up-to-date
  (no `403`).
- **URLs firmadas**: la generada por `/v1/check` valida en `/v1/download`; con `t` en el pasado da
  `403`; con `sig` alterado da `403`; una firma de otra versión no sirve para descargar esta.
- **Admin**: sin bearer → `401`; con bearer bueno y payload inválido → `400`; `maintenance on`
  escribe en KV **y** deja fila en `maintenance_log` con actor y timestamp.
- **Migraciones D1**: se aplican desde cero sobre una D1 limpia y el esquema resultante es el de C.3.
- **Contrato**: toda respuesta que produce el Worker **valida contra `CheckResponseSchema` de
  `packages/update-contract`**. Test de ida y vuelta, que es lo que impide que las dos mitades
  diverjan.

**Verificación manual, con cuenta real, documentada en `docs/05-operations/release-process.md` y
fuera de `pnpm test`:** `wrangler deploy`, DNS, los 6 pasos del e2e del roadmap (instalar 5.0.0,
publicar 5.0.1, mantenimiento on/off en la app real, `block`, sha512 manipulado a mano en D1,
medir el diferencial <25 MB).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| **Hono** | Es el framework por defecto de Workers y no es mala librería, pero son 5 rutas fijas que no van a crecer (los futuros backends son Workers aparte, ver "Frontera"). Trae middleware, validadores, tipado de contexto y una forma propia de hacer las cosas que hay que aprender y mantener actualizada, para sustituir ~60 líneas de tabla y `switch`. Es el mismo criterio con que el ADR-0004 descartó `got` y `xstate`: cero dependencias sin necesidad real, sobre todo en el componente que sirve ejecutables firmados a todos los usuarios |
| **itty-router** | Más pequeño que Hono, pero el argumento no cambia: sigue siendo una dependencia y un modelo mental para 5 rutas. Y su tipado es más flojo, con lo que habría que envolverlo igualmente para no violar `no-explicit-any` |
| **`Result<T,AppError>` serializado en el body hacia el cliente** | Obliga a `updater-client` a distinguir `200 {ok:false}` de `500`, cuando por ADR-0003 ambos acaban en "up-to-date en silencio". Es estructura para un consumidor que por diseño la ignora: código muerto por contrato. Hacia dentro sí se usa `Result`, ahí la regla no se toca |
| **Firmar el manifest dentro del Worker** (`wrangler secret put` de la privada) | Pone la clave privada en la infraestructura contra la que precisamente se firma. Un RCE en el Worker, o el acceso a la cuenta de Cloudflare, permitiría firmar un binario arbitrario y la app lo instalaría obedientemente. Rompe C.6 ("la privada solo en GitHub Secrets") y deja sin sentido la cadena entera |
| **Firmar en local desde `ycore release publish`** | La privada acabaría en el disco del portátil, en un `.env`, y tarde o temprano en un `git add -A`. Además hace que la release dependa de una máquina concreta y no sea reproducible |
| **Drizzle también para D1**, por consistencia con `apps/desktop` | Consistencia mal entendida: `apps/desktop` usa Drizzle porque su esquema evoluciona con features y tiene `better-sqlite3`. Aquí son 3 tablas ya escritas en el roadmap, `wrangler d1 migrations` ya versiona, y el driver D1 de Drizzle es andamiaje extra en un runtime distinto. Zod al parsear el resultado da el tipado que hace falta |
| **Cada lado define su propio tipo de la respuesta y se acoplan por el JSON documentado** | Es la receta para divergir. La documentación no compila. Y el fallo aparecería en producción, en el componente que actualiza a todos a la vez. Es literalmente el argumento de A.3 para `ipc-contract` |
| **Meter los schemas del update dentro de `packages/ipc-contract`** | Son dos fronteras distintas (main↔renderer vs app↔Worker). Mezclarlas permitiría al renderer importar schemas del backend y al Worker arrastrar el contrato IPC entero |
| **`/v1/download` como endpoint previo que hay que llamar para obtener la URL** | Una request de más, un fallo de red de más y un estado de más en el cliente, sin ganar nada: la URL firmada cabe perfectamente en la respuesta de `/v1/check` y así lo muestra el ejemplo de C.2 |
| **Redirigir (302) a una URL pública de R2** | El bucket es privado por decisión de C.3. Un 302 a una URL pre-firmada de R2 filtraría un enlace directo que sobrevive al TTL del navegador y sale del control del Worker. Como el egress de R2 es gratis, el proxy no cuesta nada |
| **`403` cuando el HMAC del cliente es inválido** | Le confirma al scraper que el resto de parámetros iban bien. `200` up-to-date no le dice nada y no cambia el comportamiento del cliente legítimo |
| **Confiar en el HMAC del cliente como seguridad real** | El secreto está embebido en un `.exe` sin firmar; se extrae con un desensamblador. Es ofuscación anti-scraping y se documenta como tal. La seguridad real es Ed25519 |
| **Mockear los bindings de KV/D1/R2 con objetos falsos** | El repo ya decidió lo contrario en el ADR-0004 (servidor HTTP real, SQLite real). Un doble de D1 no reproduce constraints ni tipos de SQLite, y un doble de KV no reproduce que los valores son strings. Miniflare da los tres de verdad, gratis y en local |
| **Tests de integración contra un Worker desplegado de verdad** | Requiere credenciales en CI, consume cuota del free tier y hace que un PR falle por razones ajenas al PR. Va a verificación manual documentada |
| **Un solo Worker para updates + store + señalización WebRTC** (Fases 9-11) | La versión servidor de los 167 `ipcMain.handle` del v1. Cada backend nuevo es un Worker nuevo con su ADR |
| **AWS S3 / Vercel / Railway** en vez de Cloudflare | Presupuesto 0 €. S3 cobra egress (y aquí el egress son binarios de 100 MB, que es justo lo caro); Vercel y Railway no tienen free tier viable para servir binarios |

## Consecuencias

- **Positivas**:
  - **Cero dependencias de runtime** en el Worker: solo `zod` a través de `update-contract`. Nada
    que auditar, nada que actualizar por CVE en el componente más crítico.
  - **Comprometer Cloudflare no compromete las actualizaciones.** La clave privada no está ahí. Es
    la propiedad que hace que este diseño valga la pena.
  - El 100% de la lógica interesante (rollout, decisión, firma de URLs, mantenimiento) se testea en
    local, en `workerd` real, en segundos, sin cuenta ni credenciales ni cuota.
  - Cliente y Worker no pueden divergir: comparten el mismo objeto Zod.
  - Modo mantenimiento verificable como **igualdad byte a byte** con la respuesta de "estás al día",
    que es la única forma de garantizar la indistinguibilidad que pide el ADR-0003.
  - Coste real: 0 €, con el egress de los binarios gratis en R2.

- **Negativas / lo que aceptamos pagar**:
  - **SQL a mano en D1**: sin autocompletado de columnas y sin que el compilador avise si renombras
    una. Se compensa parseando todo resultado con Zod, pero un typo en un nombre de columna se
    detecta en test, no en `typecheck`.
  - ~60 líneas de router propio que hay que mantener: matching de método y path, params y el `404`.
    Si algún día hubiera 20 rutas, esto se revisa (sería un ADR nuevo, no una edición de este).
  - **Un paquete más** en el monorepo (`update-contract`): su `package.json`, tsconfig, entrada en
    boundaries, umbral de cobertura y línea en `repo-map.md`. Aquí sí compensa, al contrario que el
    `packages/download-engine` que el ADR-0004 descartó, porque son **dos artefactos compilados por
    separado** los que necesitan el mismo tipo.
  - **Publicar una release exige un tag de git y CI.** No hay atajo desde el portátil. Es
    intencional, pero significa que si GitHub Actions está caído, no se publica.
  - El HMAC anti-scraping es **ofuscación**, y rotarlo obliga a publicar una versión de la app.
  - Miniflare cubre casi todo, pero **no** el caché del edge, ni la consistencia eventual real de
    KV (~60 s de propagación global). Consecuencia práctica: tras `ycore maintenance on`, hasta un
    minuto de clientes recibiendo todavía la respuesta anterior. Aceptable y documentado en
    `docs/05-operations/maintenance-mode.md`.
  - El límite de 100k requests/día del free tier acota los usuarios activos. Con
    `checkAgainInSeconds: 21600` (4 checks/día) da margen para ~25.000 instalaciones; llegar ahí
    sería un problema excelente y se resuelve subiendo el intervalo.

- **Qué habría que hacer para revertir esto**: la parte barata es el router (cambiar `index.ts`
  por Hono no toca `domain/` ni `data/`) y las migraciones (SQL crudo a Drizzle es mecánico). La
  parte cara y **la que exige un ADR que reemplace a este** es mover la firma al Worker o eliminar
  `packages/update-contract`: la primera destruye la propiedad de seguridad que justifica el
  diseño, la segunda reintroduce la divergencia cliente/servidor. Cambiar de Cloudflare a otro
  proveedor implica reescribir `data/` entero y renegociar el presupuesto de 0 €.

## Cómo se verifica que se cumple

```
pnpm lint            # boundaries: services/update-worker solo puede importar update-contract y
                     # result; update-contract no puede importar NADA salvo zod (ni result, ni
                     # ipc-contract, ni core-domain: es solo schemas).
                     # updater-client -> update-contract, result. Nada más.
                     # Regla no-restricted-imports que prohibe 'node:*' en todo
                     # services/update-worker: el runtime no es Node y un import de node:fs
                     # compila pero revienta en produccion.
                     # max-lines 400 / max-lines-per-function 60 / complexity 12.
                     # no-explicit-any sobre todo lo que sale de KV, D1, R2 y de la query string.

pnpm typecheck       # con @cloudflare/workers-types, no @types/node, en el tsconfig del Worker:
                     # process.env, Buffer y fs no existen y no compilan.
                     # La union discriminada de CheckResponseSchema hace que leer `artifact`
                     # de una respuesta `up-to-date` no compile, ni en el Worker ni en el cliente.

pnpm test            # vitest-pool-workers sobre workerd real. Los que protegen esta decision:
                     #  - mantenimiento: la respuesta con maintenance.enabled=true es IDENTICA
                     #    byte a byte a la de un cliente al dia. Es el corazon del ADR-0003.
                     #  - rollout determinista: mismo clientId+version -> mismo bucket siempre;
                     #    subir rollout de 10 a 50 no saca a nadie (subconjunto sobre 1000
                     #    clientIds); rollout 0 no incluye a nadie; 100 incluye a todos.
                     #  - blocked pesa mas que maintenance: un cliente en version bloqueada
                     #    recibe `blocked` aunque el mantenimiento este activo.
                     #  - HMAC de cliente alterado en un byte -> 200 up-to-date, NUNCA 403.
                     #  - URL firmada: la que emite /v1/check valida en /v1/download; expirada
                     #    -> 403; sig alterado -> 403; firma de otra version no sirve.
                     #  - admin sin bearer -> 401; payload invalido -> 400; maintenance on deja
                     #    fila en maintenance_log con actor y timestamp (D1 real de Miniflare).
                     #  - migraciones D1 aplican desde cero y producen el esquema de C.3.
                     #  - ida y vuelta: toda respuesta del Worker valida contra
                     #    CheckResponseSchema de packages/update-contract.

pnpm knip            # detecta un segundo cliente de updates o rutas muertas en el Worker.
                     # Es el checker que impide repetir los DOS caminos de actualizacion del v1.

pnpm check:docs      # exige docs/03-services/update-worker/README.md (y de paso arregla el
                     # enlace que docs/README.md ya tiene apuntando ahi).

pnpm check:contract  # todo schema de packages/update-contract tiene .describe() en cada campo,
                     # reutilizando assertDescribed de ipc-contract.
```

Checkers **nuevos** que se añaden junto con la implementación, porque sin ellos esto se erosiona en
la primera prisa:

1. **`check:worker-routes`** (`tools/scripts/check-worker-routes.mjs`): verifica que existe
   **exactamente un** `export default` con `fetch` en `services/update-worker/src/`, que toda ruta
   de la tabla `ROUTES` tiene su handler y todo handler está en la tabla, y que no hay ningún
   `addEventListener('fetch')` suelto. Es el equivalente servidor de "un solo `ipcMain.handle`", y
   lo que impide que renazcan los dos caminos del v1.
2. **`check:no-private-key`**: grep en CI de `PRIVATE_KEY`, `BEGIN PRIVATE KEY` y
   `SIGNING_KEY` bajo `services/` y `wrangler.jsonc`. La decisión del punto 5 solo vale si un
   despiste no puede meter la clave ahí. Se ejecuta también en el hook de pre-commit.
3. **Regla ESLint `no-node-builtins-in-worker`**: `no-restricted-imports` con patrón `node:*` y
   `@types/node` acotado a `services/update-worker/**`, con mensaje explicando que el runtime es
   `workerd`. Un `import { createHash } from 'node:crypto'` pasa el typecheck si alguien mete
   `@types/node` por accidente y falla en producción; esta regla lo mata antes.
4. **Umbral de cobertura del 90% en `services/update-worker/src/domain/`** (B.8), que es donde
   viven rollout, decisión y firma de URLs. El resto del servicio queda en el umbral general.
5. **Extender `check-docs.mjs`** para que recorra también `services/*` y exija su
   `docs/03-services/<servicio>/README.md`, igual que hace hoy con las features.

Verificación end-to-end manual, con binarios reales y cuenta real, en
`docs/05-operations/release-process.md`: los 6 pasos de la sección "Verificación" del roadmap.
**Deliberadamente fuera de `pnpm test`**: un test que necesita credenciales rompe PRs por motivos
que no son el PR.
