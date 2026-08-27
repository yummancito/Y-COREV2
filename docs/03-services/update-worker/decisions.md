# update-worker — decisiones locales

Decisiones de implementación de este servicio que no ameritaron ampliar el ADR-0005
(no cambian una frontera del monorepo ni una decisión ya cerrada allí).

## El bucket de rollout usa SHA-256 simple, no HMAC con clave

El roadmap (C.4) dice literalmente "bucket = HMAC(clientId + version) mod 100", pero
`computeRolloutBucket` usa `SHA-256(clientId:version)` sin clave secreta. El propósito
del cálculo es repartir de forma determinista y uniforme, no autenticar nada — el
cliente ya conoce su propio `clientId`, así que no hay nada que proteger con una clave.
Un hash simple da exactamente la misma propiedad de determinismo con una superficie más
simple: no hay clave que gestionar, rotar, ni filtrar por error. El HMAC con clave real
sí se usa donde protege algo de verdad: `signed-url.ts` (evita que se falsifique una URL
de descarga) y `auth.ts` (anti-scraping, documentado como tal).

## `buildDownloadUrl` incluye `clientId` en la query string

La firma de una URL de descarga (`signDownloadUrl`) se calcula sobre
`r2Key|expiresAt|clientId`, pero la primera versión de `decide.ts` armaba la URL sin
incluir `clientId` como parámetro — `handleDownload` no tenía forma de recuperarlo para
re-verificar la firma. Se corrigió agregando `clientId` a la query string de
`/v1/download`. Sin este parámetro, **ninguna** descarga habría podido verificarse
nunca (todas habrían fallado con 403), así que se agregaron tests que comprueban
explícitamente el ciclo completo `/v1/check` → URL emitida → `/v1/download` con esa
URL real.

## `fetchReleaseObject` distingue "rango pedido por el cliente" de "rango que R2 reporta"

R2 siempre incluye un campo `range` en el objeto devuelto por `.get()`, describiendo qué
parte se sirvió — incluso cuando no se pidió ningún rango (en ese caso, "todo el
archivo" cuenta como un rango). Comprobar `'range' in object` para decidir si responder
`200` o `206` habría hecho que **toda** respuesta fuera `206`, incluso sin `Range` en la
request. `fetchReleaseObject` devuelve `requestedRange` (el rango que el propio
`fetchReleaseObject` calculó a partir de la cabecera `Range` del cliente), no lo que R2
reporta internamente — esa es la señal correcta para el código de estado HTTP.

## `/v1/check` y `/v1/admin/release` ganan `manifestUrl`/`manifestKey`

El ADR-0003 exige verificar la firma Ed25519 del manifest antes de instalar, y
`packages/update-contract` ya tenía `ManifestSchema` con su campo `signature` — pero
`CheckResponseSchema` (la respuesta real de `/v1/check`) nunca incluía una URL para
descargar ese manifest, solo `artifact.sha512` suelto sin firma. Sin esto,
`verifyManifestSignature` de `packages/updater-client` no tenía de dónde traer un
`Manifest` real: hueco descubierto al diseñar `apps/desktop/src/main/features/updates`,
antes de escribir ningún código de cliente sobre una base incompleta.

Se cierra añadiendo `manifestKey` a `AdminReleaseSchema`/la tabla `releases`
(migración `0003_manifest_key.sql`, el pipeline de CI sube `manifest.json` ya firmado a
R2 junto al instalador) y `manifestUrl` al `artifact` de `CheckResponseSchema` — una URL
firmada más, mismo patrón que `artifact.url`/`delta.blockmapUrl`. `GET
/v1/download/:version/manifest` es el tercer `kind` válido, junto a `full`/`blockmap`.

## `yank`/`rollout`/`block` comparten una tabla de auditoría genérica

El ADR-0005 (punto 5) dice que la CLI `ycore` cubre cinco operaciones admin: `rollout`,
`yank`, `block`, `maintenance` y `stats`. `maintenance` ya tenía su propia
`maintenance_log` desde la migración `0001` (necesita columnas específicas: `enabled`).
Para las otras tres, en vez de crear tres tablas casi idénticas de una sola columna de
detalle, la migración `0002_admin_actions_log.sql` añade `admin_actions_log`
(`action`, `version`, `channel`, `actor`, `detail`, `at`) — una fila por acción, con los
campos que no aplican a null. Es la misma idea que "una tabla `downloads` con distintos
estados" en vez de una tabla por estado (ADR-0004): la auditoría de acciones admin es
por naturaleza heterogénea en qué campo importa, y una tabla genérica evita tres
esquemas casi duplicados por una diferencia de una columna.

## El estado de KV/D1/R2 no se aísla automáticamente entre tests del mismo archivo

La versión instalada de `@cloudflare/vitest-pool-workers` (0.22.0) no tiene ningún campo
`isolatedStorage` en su schema real de opciones (`WorkersPoolOptionsSchema`, confirmado
leyendo el `.d.mts` bajo `node_modules` — varias guías públicas documentan una API de
versiones anteriores). Cada suite de test que escribe en KV/D1/R2 limpia explícitamente
lo que escribió en su propio `beforeEach` (`DELETE FROM <tabla>`, `env.CONFIG.delete(...)`),
en vez de depender de un aislamiento automático que esta versión no ofrece. Ver
`aprendizaje.md` para el diagnóstico completo (incluida la confusión inicial entre
`cloudflarePool` y `cloudflareTest`, que son las dos APIs distintas del mismo paquete).
