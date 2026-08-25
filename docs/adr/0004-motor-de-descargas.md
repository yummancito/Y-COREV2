# ADR-0004: Un solo motor de descargas, con la máquina de estados pura y separada del I/O

- **Estado**: Aceptado
- **Fecha**: 2026-08-25
- **Decide**: @yummancito
- **Afecta a**: `packages/core-domain`, `packages/ipc-contract`,
  `apps/desktop/src/main/features/downloads`, `apps/desktop/src/main/db`,
  `apps/desktop/src/renderer/features/downloads`

## Contexto

La Fase 4 del roadmap pide un motor de descargas con máquina de estados explícita,
descargas reanudables por Range requests, límite de ancho de banda, verificación de
integridad, extracción, cola persistida en DB y progreso throttled a 4/s. El criterio de
HECHO es duro: **matar el proceso a mitad de descarga y reabrir tiene que reanudar donde
iba**, cero descargas duplicadas concurrentes, y **un solo store de descargas en el repo**.

Las cicatrices del v1 en esta zona concreta son las peores del proyecto:

- **La cola vivía en zustand y solo en zustand.** `src/stores/useDownloadQueueStore.ts` es
  un `create()` con `queue: QueueItem[]` en memoria y nada más. Cerrar la app perdía la
  cola entera. Y encima convivía con `useDownloadEngineV3Store`: dos fuentes de verdad para
  lo mismo, que es exactamente el patrón que `.claude/CLAUDE.md` prohíbe ("no crear un V2 de
  un store existente").
- **La deduplicación era un `some()` en memoria.** El `enqueue` del v1 comprobaba
  `queue.some(q => q.appId === item.appId) || current?.appId === item.appId`. Eso solo
  protege dentro de un mismo proceso, de un mismo tick, y desaparecía al reiniciar. De ahí
  las descargas duplicadas.
- **Un motor, cinco fuentes.** `DownloadSource` del v1 era
  `'steam-native' | 'steampipe' | 'api_proxy' | 'direct' | 'torrent'`. Un mismo `DownloadTask`
  tenía que cargar con `depotKeys`, `manifestFiles`, `directUrl` y `localPath`, todos
  opcionales, y el motor ramificaba sobre ellos. La mitad de los campos eran siempre
  `undefined` según la fuente.
- **11 estados sin transiciones declaradas.** `DownloadState` del v1 tenía `queued`,
  `preparing`, `connecting`, `downloading`, `verifying`, `paused`, `stalled`, `completed`,
  `failed`, `cancelled`, `blocked-prereq` — y ninguna tabla que dijera cuáles eran legales.
  Se pasaba de un estado a otro con asignaciones sueltas repartidas por el motor. Existía un
  `download-engine-repair.ts` cuyo motivo de existir era arreglar tareas que se quedaban en
  estados imposibles.
- **La extracción ya nos mordió con Defender.** `fix-installer.service.ts` del v1 lleva el
  comentario `RAR no es soportado - Defender bloqueará WinRAR/7z execution`. Lanzar un
  binario externo de compresión desde la app es un disparador conocido de la heurística que
  ya nos bloquea sin certificado de firma (ver ADR-0003 y sección C.6 del roadmap).

Restricciones que condicionan todo lo de abajo: **presupuesto 0 €** (nada de licencias),
**Windows-only**, **cero deuda técnica sobre velocidad**, `Result<T, AppError>` en toda
frontera, prohibido `any`, 400 líneas por archivo y 60 por función, y prohibido que una
feature del main importe de otra.

### De dónde vienen los archivos

El roadmap **no lo dice** para Fase 4, y hay que fijarlo aquí porque condiciona el resto.
La Fase 5 (Worker + R2) es solo para actualizaciones de la app, no para juegos. La decisión
que se toma es: **este motor descarga desde URLs HTTP(S) que le llegan como dato**, sin
saber ni preguntar quién las produjo. Ni resuelve catálogos, ni habla con Steam, ni sabe qué
es un depot. Quien produzca esas URLs en el futuro (el Worker de Fase 11, un plugin, o el
propio usuario) le pasa una URL y un hash esperado. **Torrent, steampipe y "steam-native"
quedan explícitamente fuera de este ADR**: fue meter esas cinco fuentes en un motor lo que
hizo ingobernable el del v1. Si algún día hacen falta, entran como plugin (Fase 7+) o como
un ADR nuevo, nunca como una rama más dentro de este motor.

## Decisión

Se construye **un único motor de descargas**, con la máquina de estados como **función pura
en `packages/core-domain`** y todo el I/O (HTTP, disco, DB, eventos) en
`apps/desktop/src/main/features/downloads`. La cola vive en SQLite, no en memoria y **nunca**
en zustand.

Los ocho puntos, cerrados:

### 1. Transporte HTTP: `undici` (el que ya trae Node), sin librería de descargas

Se usa **`undici` a través de la API global `fetch` de Node 20+**, que Electron 33 ya
incorpora. **Cero dependencias nuevas.** La reanudación es una cabecera `Range:
bytes=<offset>-` y comprobar que la respuesta es `206 Partial Content`; el streaming a disco
es `Readable.fromWeb(response.body).pipe(createWriteStream(path, { flags: 'a' }))`. Eso es
todo lo que hace falta.

Reglas del transporte:

- Si el servidor responde `200` en vez de `206` a un Range, **no soporta reanudación**: se
  trunca el archivo parcial, se resetea `bytesDownloaded` a 0 y se empieza de cero. Nunca se
  concatena una respuesta completa detrás de bytes ya escritos (ese es el bug clásico que
  produce archivos corruptos que solo se detectan al verificar el hash).
- Antes de reanudar se valida que el recurso no ha cambiado, con `If-Range` usando el `ETag`
  guardado (o `Last-Modified` si no hay ETag). Si el servidor invalida el rango, se reinicia
  la descarga desde 0.
- **Segmentación: una sola conexión por descarga en la v1 del motor.** El roadmap pide
  "segmentadas y reanudables"; se implementa la **reanudación** ahora y se deja la
  paralelización por segmentos preparada en el esquema (`segmentIndex`/`segmentCount`, ver
  punto 3) pero **desactivada**. Motivo: N conexiones concurrentes por descarga multiplican
  por N los estados intermedios que hay que persistir y reconciliar tras un kill -9, y el
  criterio de HECHO de la fase es reanudar correctamente, no ir rápido. Activar segmentación
  real será un ADR que reemplace a este, con su test de kill a mitad.
- **Límite de ancho de banda**: token bucket propio, en `core-domain`, puro y testeable con
  reloj inyectado. El consumidor del stream pide permiso para N bytes antes de escribirlos.
  Nada de `setTimeout` esparcidos por el pipe.

### 2. Máquina de estados: unión discriminada + tabla de transiciones, en TypeScript plano

Nada de xstate. Se declara:

```
queued -> downloading | failed
downloading -> verifying | paused | failed
paused -> downloading | failed
verifying -> extracting | failed
extracting -> installing | failed
installing -> done | failed
failed -> queued          (reintento explícito del usuario)
done -> (terminal)
```

Implementado como una **unión discriminada por `status`** (cada estado lleva solo los datos
que ese estado tiene sentido que lleve: `downloading` lleva `bytesDownloaded` y `etag`,
`failed` lleva el `AppError`, `done` no lleva ninguno de los dos) más una **tabla constante
`ALLOWED_TRANSITIONS: Readonly<Record<Status, ReadonlySet<Status>>>`** y una única función
`transition(current, event): Result<DownloadState, AppError>` que devuelve
`err(appError('download.invalid-transition'))` si el par no está en la tabla.

Esto elimina de raíz el `download-engine-repair.ts` del v1: **no se puede escribir un estado
inválido porque no existe otro camino para cambiar de estado que esa función**.

`paused` es un estado real y persistido, no un flag. `cancelled` no existe como estado: se
borra la fila y el archivo parcial (el v1 tenía `cancelled` y `completed` coexistiendo con
filas zombis que nadie limpiaba).

### 3. Esquema de la cola en Drizzle

Tabla `downloads` en `apps/desktop/src/main/db/schema.ts`, en el mismo estilo del `games` ya
existente (columnas planas, nullable en vez de objetos anidados, el mapeo a dominio lo hace
el repositorio de la feature):

| Columna | Tipo | Para qué |
|---|---|---|
| `id` | `text` PK | UUID de la descarga |
| `app_id` | `integer` NOT NULL | El juego al que pertenece |
| `status` | `text` NOT NULL | El discriminante de la unión; se valida contra la lista al leer |
| `source_url` | `text` NOT NULL | De dónde se descarga |
| `destination_path` | `text` NOT NULL | Ruta final del archivo descargado |
| `install_path` | `text` NOT NULL | Dónde se extrae/instala |
| `bytes_downloaded` | `integer` NOT NULL DEFAULT 0 | **El offset del `Range` al reanudar** |
| `bytes_total` | `integer` | `Content-Length`; null hasta la primera respuesta |
| `etag` | `text` | Para el `If-Range`: detecta que el recurso cambió |
| `last_modified` | `text` | Fallback de `etag` |
| `expected_sha256` | `text` NOT NULL | El hash que tiene que dar el archivo (punto 7) |
| `segment_index` | `integer` NOT NULL DEFAULT 0 | Reservado para segmentación futura |
| `segment_count` | `integer` NOT NULL DEFAULT 1 | Idem; siempre 1 hoy |
| `error_code` | `text` | El `AppErrorCode` cuando `status = 'failed'` |
| `retry_count` | `integer` NOT NULL DEFAULT 0 | Backoff |
| `created_at` / `updated_at` | `text` NOT NULL | ISO 8601, como `last_played_at` de `games` |

Lo que **no** lleva la tabla, a propósito: `speedBytesPerSec`, `etaSeconds` y `percent`. Son
derivados, cambian varias veces por segundo y escribirlos sería martillear el disco. Se
calculan en memoria y viajan solo en el evento de progreso. El v1 los tenía en el `DownloadTask`
persistido.

`bytes_downloaded` se persiste **con throttle propio de 1/s** y, obligatoriamente, en cada
transición de estado. Tras un kill, como mucho se repite el último segundo de descarga: el
tamaño real del archivo en disco es la verdad, y al reanudar se toma
`min(bytes_downloaded, statSync(path).size)` como offset. Nunca al revés.

### 4. Cero duplicados: constraint de DB **y** lock en memoria, las dos cosas

- **DB**: índice único parcial
  `CREATE UNIQUE INDEX downloads_active_app ON downloads(app_id) WHERE status != 'done' AND status != 'failed'`.
  Insertar una segunda descarga activa del mismo `app_id` **falla en SQLite**, no en un `if`.
  Esto es lo que sobrevive a reiniciar el proceso, que es donde el `some()` del v1 fallaba.
- **Memoria**: un `Map<downloadId, AbortController>` de descargas en vuelo dentro del
  servicio. La DB impide dos filas; el `Map` impide dos *streams* sobre la misma fila (que la
  DB no ve). Es el que protege de que dos llamadas IPC casi simultáneas abran dos conexiones
  para la fila que ya existe.

Las dos, no una. Cada una cubre un fallo que la otra no ve.

### 5. Throttling de progreso a 4/s con último evento garantizado

Un `ProgressThrottle` **puro, en `core-domain`**, con reloj inyectado: recibe cada muestra
de progreso y decide si toca emitir. Regla, en este orden:

1. Si han pasado ≥ 250 ms desde la última emisión, emite.
2. Si no, **guarda la muestra como pendiente** (sobrescribiendo la anterior).
3. `flush()` emite la pendiente si la hay. **Se llama `flush()` obligatoriamente antes de
   toda transición de estado y al completar.**

Así el último evento antes de `verifying` nunca se pierde: no es un `setTimeout` que se
cancela al terminar (el error habitual), es una muestra pendiente que la transición vacía.
Testeable sin timers reales porque el reloj entra por parámetro.

### 6. Fronteras: `core-domain` para lo puro, `main/features/downloads` para el I/O

**No se crea `packages/download-engine`.** Un paquete nuevo hay que declararlo en
`boundariesSettings` de `packages/eslint-config/rules-de-boundaries.js`, darle su
`package.json`, su tsconfig, su umbral de cobertura y su entrada en el `repo-map.md` — todo
eso para albergar tres funciones puras. `core-domain` ya está permitido desde `main-feature`
en la matriz de boundaries, ya tiene el 90% de cobertura exigido, y su regla es "cero I/O,
solo depende de `result`", que es exactamente lo que estas piezas cumplen.

A `packages/core-domain` van, sin tocar disco ni red:
`download-state.ts` (la unión discriminada + `ALLOWED_TRANSITIONS` + `transition`),
`progress-throttle.ts`, `token-bucket.ts` (ancho de banda).

A `apps/desktop/src/main/features/downloads/` va todo lo demás, con el patrón vertical ya
establecido por `library/` y `steam/`:
`repository.ts` (Drizzle), `service.ts` (orquesta la máquina), `http-client.ts` (Range,
`If-Range`, reintentos), `verifier.ts`, `extractor.ts`, `handlers.ts`, `index.ts` con la API
pública explícita.

**La feature `downloads` no importa de `library` ni de `steam`.** Recibe `appId`, URL, hash
y rutas como datos de entrada; no consulta la biblioteca. Si en algún momento hiciera falta
lógica compartida, sube a `core-domain` (B.3 del roadmap).

En el renderer: **un solo `store.ts` en `renderer/features/downloads`, con zustand y solo
para UI** (qué descarga está seleccionada, el filtro de la lista). El estado de las descargas
—cola, progreso, estados— llega por **TanStack Query**, invalidado por los eventos de
progreso. Escribir progreso en zustand es literalmente lo que produjo los dos stores del v1.

### 7. Integridad: SHA-256 incremental durante la descarga, verificado antes de extraer

**SHA-256** (`node:crypto`, cero dependencias). No SHA-512: el manifest de updates usa SHA-512
por compatibilidad con el blockmap de electron-builder (ADR-0003), pero aquí no hay esa atadura
y SHA-256 es más rápido con margen de seguridad de sobra para verificar integridad.

**Dónde**: el hash se alimenta **incrementalmente mientras se escriben los bytes**, no
releyendo el archivo al final. Releerlo significaría leer otra vez decenas de GB de disco.

**Excepción, importante**: si la descarga se reanuda tras un reinicio del proceso, el estado
incremental del hash se perdió (no es serializable). En ese caso el verificador **relee el
archivo completo una vez** al llegar a `verifying`. Es el precio de reanudar, y es correcto:
verificar mal es peor que verificar lento.

Si el hash no cuadra: se borra el archivo, se pasa a `failed` con
`appError('download.integrity-mismatch', { retriable: true })` y se permite reintentar desde
0. **Nunca se extrae un archivo que no ha verificado.**

### 8. Extracción: solo ZIP, con `yauzl` en proceso. Nada de binarios externos

Formato soportado inicialmente: **ZIP y nada más**. Con **`yauzl`** (streaming, ~una
dependencia sin transitivas pesadas, MIT, sin binarios nativos).

Por qué no 7z/RAR con un binario externo: ya nos pasó. El v1 dejó escrito
`RAR no es soportado - Defender bloqueará WinRAR/7z execution`. Empaquetar `7z.exe` en la app
sube el instalador (presupuesto de <120 MB, B.9), sube la entropía del paquete y dispara
exactamente la heurística de Defender que ya nos bloquea porque no hay certificado de firma.
Y `adm-zip`, que usó el v1, **carga el ZIP entero en memoria**: inviable para un juego.

Reglas duras de la extracción, porque un ZIP es entrada no confiable:

- **Zip-slip**: toda entrada se resuelve contra `install_path` y se rechaza la que se salga
  (`..`, rutas absolutas, `C:\`). Test de regresión obligatorio con un ZIP malicioso de fixture.
- Se rechazan enlaces simbólicos dentro del ZIP.
- Se extrae a un directorio temporal hermano y se hace `rename` atómico al final: una
  extracción interrumpida nunca deja un `install_path` a medias que parezca completo.

Si más adelante hace falta otro formato, se añade tras un ADR que evalúe el coste en Defender.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| **xstate** para la máquina de estados | ~40 KB y un modelo mental entero (actores, servicios, guards, `interpret`) para 8 estados y 12 transiciones que caben en una tabla constante. La regla del repo es cero dependencias sin necesidad real, y las transiciones puras ya son testeables al 100% sin él. Además su estado no se serializa trivialmente a una columna SQLite, que es justo lo que necesitamos para reanudar |
| **Enum simple + `if`s de transición** repartidos por el servicio | Es exactamente el v1: 11 estados, ninguna tabla, y un `download-engine-repair.ts` para arreglar los estados imposibles que se producían. La unión discriminada además impide que `done` tenga un `errorCode` |
| **`got` / `axios` / `node-downloader-helper`** | `got` y `axios` son dependencias grandes para lo que aquí es una cabecera `Range` y un pipe. `node-downloader-helper` sí trae reanudación, pero es una dependencia poco mantenida a la que habría que envolver igualmente para devolver `Result` y para meter el token bucket. `undici` ya está en Node y en Electron: cero coste |
| **`electron-dl`** | Descarga vía la sesión de Chromium: sin control real sobre Range, sin límite de ancho de banda, sin reanudación entre ejecuciones. Es para "guardar un archivo", no para un motor de instalación |
| **Un paquete `packages/download-engine`** | Coste de andamiaje (package.json, tsconfig, boundaries, cobertura, repo-map) desproporcionado para tres funciones puras que `core-domain` ya admite. Se puede extraer más tarde sin romper a nadie si crece; crear un paquete que luego hay que borrar sí es deuda |
| **Cola solo en memoria, persistida al salir** (v1) | No sobrevive a un crash ni a un kill, que es literalmente el criterio de HECHO de la fase. Y `app.on('before-quit')` no se ejecuta cuando el proceso muere de verdad |
| **Deduplicar solo con un lock en memoria** | Es el `queue.some()` del v1. No sobrevive al reinicio, y ahí es donde aparecían los duplicados |
| **Dedupe solo con el índice único de la DB** | No ve dos streams abiertos sobre la misma fila por dos llamadas IPC casi simultáneas. Por eso van las dos |
| **Guardar velocidad/ETA/porcentaje en la DB** (v1) | Son derivados que cambian 60 veces por segundo; persistirlos es martillear el disco para nada. Van en el evento, no en la tabla |
| **`throttle` de lodash para el progreso** | Su `trailing` depende de un timer que hay que dejar correr; al completar la descarga y desmontar, el último evento se pierde o llega tarde. El throttle propio con `flush()` explícito en cada transición lo garantiza, y es puro y testeable sin timers |
| **Soportar 7z/RAR con binario empaquetado** | Ya documentado en el v1 que Defender bloquea la ejecución de WinRAR/7z; además sube el instalador y la entropía, sin certificado de firma que lo compense |
| **`adm-zip`** (lo que usaba el v1) | Carga el archivo entero en memoria. Con un juego es imposible |
| **Meter torrent / steampipe / steam-native en el mismo motor** | Las cinco fuentes del v1 en un solo `DownloadTask` con cuatro campos opcionales excluyentes es lo que lo hizo ingobernable. Si hacen falta, van como plugin (Fase 7+) con su propio ADR |

## Consecuencias

- **Positivas**:
  - Reanudación real tras `kill -9`, porque la verdad está en SQLite y en el tamaño del
    archivo en disco, no en memoria.
  - Un estado inválido es **inexpresable**: no hay más camino que `transition()`, y la unión
    discriminada impide combinaciones de campos sin sentido. Adiós al `download-engine-repair`.
  - Duplicados imposibles: SQLite los rechaza aunque el proceso se reinicie.
  - **Cero dependencias nuevas salvo `yauzl`**. Nada que pagar, nada que auditar, nada que
    disparar a Defender.
  - El 100% de la lógica interesante (transiciones, throttle, ancho de banda) se testea en
    Node puro, en milisegundos, sin Electron ni red.
  - Un solo store y una sola fuente de verdad de las descargas en todo el repo.

- **Negativas / lo que aceptamos pagar**:
  - Escribimos a mano el cliente HTTP con Range, `If-Range`, backoff y truncado. Son las
    partes delicadas y hay que testearlas contra un servidor de test que mienta a propósito
    (responde 200 a un Range, cambia el ETag a mitad, corta la conexión).
  - **Sin descarga segmentada real todavía**: una sola conexión por descarga. Más lento de lo
    que podría ser. Aceptado a cambio de una reanudación que funciona de verdad.
  - Reanudar tras reiniciar el proceso obliga a releer el archivo entero para verificar el
    hash. Con un juego grande eso son minutos de I/O.
  - Solo ZIP. Cualquier otro formato exige un ADR.
  - Hasta 1 segundo de descarga repetida tras un kill (el throttle de persistencia).

- **Qué habría que hacer para revertir esto**: la parte reversible sin dolor es el transporte
  (cambiar `http-client.ts` por una librería no toca ni la máquina de estados ni la tabla). La
  parte cara es la cola en DB: volver a una cola en memoria significaría renunciar al criterio
  de HECHO de la Fase 4, y exigiría un ADR que reemplace a este. Activar segmentación real o
  añadir un formato de extracción son ADRs nuevos, no ediciones de este.

## Cómo se verifica que se cumple

```
pnpm lint            # boundaries: main/features/downloads no importa de library ni de steam;
                     # core-domain sigue sin poder importar nada que no sea result (o sea,
                     # download-state.ts / progress-throttle.ts / token-bucket.ts no pueden
                     # tocar node:fs ni undici ni Electron aunque alguien lo intente).
                     # max-lines 400 / max-lines-per-function 60 / complexity 12.
                     # no-explicit-any sobre todo lo que sale de la red.

pnpm typecheck       # la unión discriminada hace que leer `bytesDownloaded` de un estado
                     # `done`, o `errorCode` de uno `downloading`, no compile.

pnpm test            # los tests que protegen esta decisión, todos obligatorios:
                     #  - transiciones: toda transición fuera de ALLOWED_TRANSITIONS
                     #    devuelve err('download.invalid-transition'). Tabla exhaustiva
                     #    estado x estado, no una muestra.
                     #  - kill a mitad: escribir una fila `downloading` con N bytes en una
                     #    DB real (openInMemoryDb), reabrir, y comprobar que el motor pide
                     #    `Range: bytes=N-`. Es el criterio de HECHO de la fase.
                     #  - servidor que responde 200 a un Range -> el parcial se trunca y se
                     #    empieza de 0; jamas se concatena.
                     #  - ETag distinto al reanudar -> se reinicia desde 0.
                     #  - duplicados: insertar dos descargas activas del mismo app_id contra
                     #    SQLite real falla por el indice unico parcial.
                     #  - throttle: con reloj falso, 1000 muestras en 1 s emiten 4 eventos,
                     #    y flush() antes de la transicion emite la ultima muestra pendiente
                     #    (el ultimo progreso nunca se pierde).
                     #  - integridad: hash que no cuadra -> failed, el archivo se borra y
                     #    NUNCA se llama al extractor.
                     #  - zip-slip: fixture de ZIP con una entrada `../../evil.exe` -> se
                     #    rechaza y no se escribe nada fuera de install_path.

pnpm knip            # detecta si alguien deja un segundo store/servicio de descargas muerto
                     # en el repo, que es como nacieron los dos del v1.

pnpm check:docs      # exige docs/02-features/downloads/README.md, con el DIAGRAMA de la
                     # maquina de estados (criterio de HECHO de la Fase 4).

pnpm check:contract  # todo canal downloads.* declarado en packages/ipc-contract con Zod y
                     # .describe(), y con handler registrado.
```

Checkers **nuevos** que hay que añadir junto con la implementación, porque sin ellos esta
decisión se erosiona en la primera prisa:

1. **Regla ESLint `no-download-state-in-zustand`** (o regla R8 en
   `tools/scripts/check-file-rules.mjs`): prohíbe que cualquier archivo bajo
   `renderer/features/downloads/store.ts` mencione `bytesDownloaded`, `progress`, `speed`,
   `queue` o `status`. zustand ahí es solo selección y filtros. **Es el checker que impide
   que renazcan los dos stores del v1.**
2. **Test de "un solo motor"**: `grep` en CI de `ipcMain`/servicios de descarga fuera de
   `main/features/downloads/`, y de que existe exactamente **un** archivo `store.ts` bajo
   `renderer/features/downloads/`.
3. **Umbral de cobertura**: `core-domain` sigue en 90% (B.8), lo que obliga a que la máquina
   de estados, el throttle y el token bucket estén testeados de verdad y no de adorno.
