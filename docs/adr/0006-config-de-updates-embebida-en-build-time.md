# ADR-0006: Embeber la config pública de updates en build time con `define`, y hacer que un build de release sin ella falle el CI

- **Estado**: Aceptado
- **Fecha**: 2026-08-27
- **Decide**: @yummancito
- **Afecta a**: `apps/desktop` (`electron.vite.config.ts`,
  `src/main/bootstrap/update-scheduler.ts`), `tools/scripts`,
  `.github/workflows/release-desktop.yml`, `docs/02-features/updates`,
  `docs/05-operations/release-process.md`, `docs/06-security/signing.md`

## Contexto

El ADR-0003 decidió el cliente de actualizaciones propio y el ADR-0005 decidió el Worker,
la firma Ed25519 en CI y el HMAC anti-scraping. Ambos dan por hecho que el cliente
**conoce tres valores**: la URL del Worker, el secreto compartido del HMAC y las claves
públicas Ed25519 con las que verificar el manifest. **Ninguno de los dos dijo cómo llegan
esos tres valores al `.exe` que ejecuta un usuario final.** Este ADR cierra ese hueco. No
reemplaza a ninguno de los dos: es la pieza que faltaba entre ellos.

### El fallo concreto que existe hoy en el repo

`apps/desktop/src/main/bootstrap/update-scheduler.ts`, en `readUpdateServiceConfig`, lee:

```
process.env['YCORE_WORKER_URL']
process.env['YCORE_CLIENT_SECRET']
process.env['YCORE_MANIFEST_PUBLIC_KEYS']   // una o dos, coma-separadas
```

Si falta cualquiera de las tres devuelve `null` y `createUpdateService` construye un
`UpdateService` **inerte** que siempre reporta `up-to-date`. Eso es deliberado y correcto
(el arranque de Y-CORE nunca puede depender de la config de updates), y está documentado
en `docs/02-features/updates/decisions.md`.

El problema no es el modo inerte: es que **hoy nada convierte esas variables en parte del
binario**. `electron.vite.config.ts` no tiene ningún `define`; `electron-builder.yml` no
inyecta nada; `release-desktop.yml` solo pasa `YCORE_WORKER_URL` al paso que llama a la
CLI, no al paso `pnpm --filter @ycore/desktop package:win`. El proceso main del usuario
final **no hereda el entorno de la máquina de CI que lo compiló**. Consecuencia verificada
leyendo el código, no supuesta: **en producción real la feature de updates queda inerte
siempre, en silencio**. No rompe nada — y por eso es peor: es una feature completa
(ADR-0003, ADR-0005, un Worker desplegado, una CLI, un pipeline de firma) que nunca se
ejecuta, y nada avisa.

### Qué es secreto aquí y qué no

Distinción que decide casi todo lo de abajo, y que ya está cerrada por ADR-0005 punto 5 y 6:

| Valor | ¿Secreto real? | Dónde vive |
|---|---|---|
| `YCORE_SIGNING_KEY_BASE64` (privada Ed25519) | **Sí, el único** | GitHub Secret. Solo la usa el paso de firma de CI. **Jamás toca el bundle del cliente** |
| `YCORE_MANIFEST_PUBLIC_KEYS` (públicas Ed25519) | No. Es pública por definición | Debe estar **dentro** del `.exe` para verificar el manifest |
| `YCORE_CLIENT_SECRET` (HMAC anti-scraping) | No en el cliente. Sí en el Worker | `wrangler secret put` en el Worker; embebido en el `.exe`. ADR-0005 punto 6 ya lo llama ofuscación, no seguridad |
| `YCORE_WORKER_URL` | No | Embebido en el `.exe` |
| `YCORE_ADMIN_TOKEN` | Sí | GitHub Secret. Solo para la CLI. **No entra nunca en el cliente** |

Los tres del cliente son **configuración pública**: cualquiera con el `.exe` y un
desensamblador los saca, y eso está aceptado y documentado en
`docs/06-security/threat-model.md`. La seguridad real es Ed25519, que no depende de que
ninguno de los tres sea secreto.

Pero "no secreto" no significa "hardcodeable en un commit". Dos requisitos que sí importan:

1. **Trazabilidad**: el valor que acaba en un release debe venir de la infraestructura
   desplegada (el Worker real, el secret real subido con `wrangler secret put`, la clave
   pública realmente generada), no de que alguien copiara una cadena a mano en un `.ts`
   y nadie sepa después si sigue coincidiendo con el Worker.
2. **No reproducible por un clon del repo**: el repo es closed-source hoy, pero un clon,
   un fork interno o un build de un colaborador **no deben apuntar por accidente al Worker
   de producción con el secreto de producción**. Si el valor está en git, cualquier build
   local es un cliente de producción indistinguible de uno real en `check_stats`.

### Las cicatrices del v1 que aplican

- El v1 tenía **la URL de actualización escrita a mano en el código**, en más de un sitio,
  y nadie sabía cuál era la buena. Es el mismo tipo de duplicación que produjo los dos
  motores de descargas.
- El v1 **no tenía forma de saber si las actualizaciones funcionaban** hasta que un usuario
  se quejaba. Un release que compila, se firma, se sube a R2, se registra en D1 — y cuyo
  cliente nunca pregunta — es exactamente ese fallo, con más pasos.

## Decisión

**Los tres valores se sustituyen estáticamente en el bundle del proceso main en build
time, con `define` de electron-vite, leyendo del entorno del proceso de build; y en un
build de release (`CI` + tag) faltar cualquiera de ellos hace fallar el build, no degradar
a inerte.**

Cinco puntos, cerrados:

### 1. Mecanismo: `define` de electron-vite sobre el bundle `main`, y solo sobre `main`

En `electron.vite.config.ts`, dentro de la sección `main` (y **solo** ahí; ni `preload` ni
`renderer` los ven), se declara:

```
define: {
  'process.env.YCORE_WORKER_URL': JSON.stringify(...),
  'process.env.YCORE_CLIENT_SECRET': JSON.stringify(...),
  'process.env.YCORE_MANIFEST_PUBLIC_KEYS': JSON.stringify(...),
}
```

Los valores salen de `process.env` **del proceso que ejecuta el build**, no del que ejecuta
la app. Rollup los sustituye como literales en `out/main/index.js`, así que en runtime el
usuario final lee una cadena constante y no una variable de entorno que nunca existirá.

Consecuencia deliberada y buena: **`update-scheduler.ts` no cambia una línea de lógica**.
Sigue escrito como "leo tres variables de entorno; si falta alguna, modo inerte". El modo
inerte sigue existiendo y sigue siendo la red de seguridad en runtime (es lo que cubre un
`.exe` construido por alguien sin config). Lo único que cambia es que en un build de
release esas tres "variables de entorno" ya no son variables: son literales incrustados.

Precisiones que forman parte de la decisión y no son detalle de implementación:

- **`define` va en la sección `main`, nunca en `renderer`.** El secreto del HMAC en el
  bundle del renderer sería exponerlo a cualquier `devtools` abierto y a cualquier
  contenido remoto que llegara a cargarse ahí. El renderer no habla con el Worker: habla
  con el main por IPC (ADR-0002). Con checker (punto 5).
- **Se sustituye `process.env.X`, no se introduce `import.meta.env`.** El código ya está
  escrito contra `process.env` y el patrón `import.meta.env` arrastra las convenciones de
  Vite (prefijo `VITE_`, exposición al cliente) que aquí solo confunden: la regla "todo lo
  que empieza por `VITE_` es público" es exactamente la que no queremos tener que recordar
  en el proceso que sostiene el secreto del HMAC.

  > Aviso: `update-scheduler.ts` accede hoy como `process.env['YCORE_WORKER_URL']` (índice
  > con corchetes, por `noPropertyAccessFromIndexSignature`). `define` sustituye texto sobre
  > el AST por la clave `process.env.YCORE_WORKER_URL` (punto). Al implementar hay que dejar
  > las dos formas coincidiendo — es el único detalle capaz de hacer que esto "funcione en
  > el config" y siga inerte en el `.exe`. El test del punto 5 existe precisamente para
  > cazar eso.
- **Ningún valor por defecto que apunte a producción.** Si la variable no está en el
  entorno del build, se sustituye por `undefined` (literal), que es lo que dispara el modo
  inerte. Nunca un fallback a `https://ycore-update-worker...` en el config: eso es
  hardcodear la URL con pasos extra, y hace que un clon del repo apunte a producción, que
  es justo el requisito 2 del contexto.

### 2. De dónde salen los valores en CI (el build que se publica)

De **GitHub Secrets del repo**, inyectados como `env:` del paso
`pnpm --filter @ycore/desktop package:win` en `release-desktop.yml`:

| Nombre | Tipo en GitHub | Ya existe |
|---|---|---|
| `YCORE_WORKER_URL` | Secret (ya está) | Sí |
| `YCORE_CLIENT_SECRET` | **Secret, a crear** | No |
| `YCORE_MANIFEST_PUBLIC_KEYS` | **Secret, a crear** | No |

Los tres como **Secret**, no como Variable, aunque dos de ellos no sean secretos de
verdad. Razón: un Secret sale enmascarado de los logs de Actions por defecto, y el coste
de esa elección es cero (no necesitamos verlos en el log; si hace falta comprobar cuál se
usó, se comprueba con la huella del punto 4, que es lo que hay que mirar de todas formas).
Usar Variables solo para "poder verlos" es optimizar la depuración a costa de tener el
secreto del HMAC en texto plano en cada log de release.

Además, `package:win` **hoy no reconstruye**: el paso previo `pnpm check:all` no compila
el bundle de producción. La implementación debe garantizar que el `electron-vite build`
que produce `out/` corre **con esas tres variables presentes** — si el bundle se generó
antes en un paso sin ellas, `define` no las vio y el `.exe` sale inerte igualmente. Es la
forma exacta en que esta decisión se puede implementar mal y parecer implementada; el
checker del punto 5 la cubre inspeccionando el artefacto, no el config.

**`YCORE_SIGNING_KEY_BASE64` no aparece en este paso, y `YCORE_ADMIN_TOKEN` tampoco.**
Cada uno sigue viviendo solo en el paso que lo necesita (firma y CLI respectivamente). Un
secret que no se pasa a un paso no puede filtrarse en ese paso.

**Correspondencia con la infraestructura real**: el valor de `YCORE_CLIENT_SECRET` en
GitHub Secrets tiene que ser **el mismo** que se subió con
`wrangler secret put YCORE_CLIENT_SECRET`, y `YCORE_MANIFEST_PUBLIC_KEYS` la pública
correspondiente a `YCORE_SIGNING_KEY_BASE64`. Esa correspondencia no la puede verificar
ningún checker local (no tenemos el secreto del Worker en el repo, y menos mal), así que
se verifica **en el propio pipeline**, contra el Worker real, con el smoke test del punto
5.2, y el procedimiento de qué poner en cada sitio se documenta en
`docs/05-operations/release-process.md`.

### 3. De dónde salen en dev local: `.env.local` gitignored, y la app inerte por defecto

**Por defecto, `pnpm --filter @ycore/desktop dev` deja la feature de updates inerte, y eso
es correcto.** No es una carencia: es el requisito 2 del contexto. Una sesión de desarrollo
no debe ser un cliente de producción — contaminaría `check_stats`, consumiría cuota del
free tier de 100k req/día y, sobre todo, un `pnpm dev` en la máquina de cualquiera acabaría
descargando e instalando un instalador de producción sobre su entorno de trabajo.

Para el caso legítimo de querer probar el ciclo de updates en local se admite un
**`apps/desktop/.env.local`**, ya cubierto por `.gitignore` (`.env.*` con
`!.env.example`), leído por el config del punto 1 antes de construir el `define`. Se
acompaña de un **`apps/desktop/.env.example`** commiteado, con las tres claves, valores
vacíos y un comentario por cada una explicando de dónde se saca el valor real. Lo apuntado
ahí, por decisión: al **Worker de staging o a un `wrangler dev --local`**, nunca al Worker
de producción. Publicar el valor de producción en un `.env.example` sería reintroducir el
hardcodeo por la puerta de atrás.

El aviso `configuración de updates incompleta en el entorno` que hoy sale en cada arranque
de dev se queda tal cual, en nivel `warn`: es información correcta y ahora además es la
única señal visible de que estás en modo inerte.

### 4. Un build de RELEASE sin config **falla el CI**. En runtime nunca falla nada

Este es el trade-off que el ADR tiene que resolver, y se resuelve **partiendo la pregunta
en dos**, porque son dos garantías distintas que se estaban confundiendo:

- **Garantía de runtime (ADR-0003, intacta)**: la app **jamás** rompe el arranque, ni
  muestra un error, por nada relacionado con updates. El modo inerte de
  `createInertUpdateService` se queda exactamente como está. Nadie toca eso.
- **Garantía de build (nueva, aquí)**: un artefacto **etiquetado como release** en el que
  la config falta es un **artefacto defectuoso**, y CI no debe publicarlo. Un `.exe` que
  nunca comprobará actualizaciones no se puede corregir después: hay que publicar una
  versión nueva, y los usuarios que instalaron la defectuosa **no se enterarán jamás**,
  porque el mecanismo que les avisaría es precisamente el que falta. Es un fallo
  **irreversible en campo**, y esos son exactamente los que se detienen en CI.

Por tanto, la regla es una condición sobre el **entorno del build**, no sobre el runtime:

```
si (CI y build de release)  y  falta cualquiera de las tres  ->  el build falla, con
   un mensaje que nombra cuál falta y dónde se configura.
en cualquier otro caso     ->  se sustituye por undefined y la app queda inerte.
```

"Build de release" se determina por el entorno del pipeline (el workflow disparado por tag
`v*`), y se materializa en una variable explícita de ese workflow —
`YCORE_REQUIRE_UPDATE_CONFIG=1` — en vez de olfatear `process.env.CI`. Razón: `CI` está
puesto en cualquier PR, y un PR **no** debe necesitar los secrets de producción para que
`pnpm build` pase (un fork o un PR de un colaborador no los recibe: fallaría por algo que
no es el PR, exactamente el criterio con el que el ADR-0005 dejó los tests con credenciales
fuera de `pnpm test`). Un flag explícito hace que la exigencia sea una propiedad del
workflow de release, legible en su YAML, y no un efecto lateral de dónde corre.

Que el build falle en el config es un `throw` — y está bien: **el config de build no es una
frontera de la app**. La regla "prohibido `throw` cruzando fronteras" protege IPC, plugins
y servicios en runtime. `electron.vite.config.ts` es una herramienta de build cuyo canal de
error es el exit code, igual que `check-no-private-key.mjs`. No se devuelve `Result` desde
un archivo de config.

### 5. Cómo se verifica (resumen; el detalle está abajo)

Tres capas, porque ninguna sola cubre el fallo:

1. **`check:build-config`** (nuevo, en `pnpm check:all`): estático. Que el `define` exista
   en la sección `main` y **no** en `preload`/`renderer`, que no haya valores literales de
   producción en el config, y que el conjunto de claves del `define` sea exactamente el
   conjunto que `update-scheduler.ts` lee. Es el checker que impide que una cuarta variable
   aparezca en el código y nadie la añada al build (el fallo de hoy, repetido).
2. **Test de integración de build** (en `pnpm test`): construye el bundle main con valores
   ficticios en el entorno y comprueba que **aparecen literalmente en `out/main/index.js`**;
   y que sin ellos, no. Verifica el artefacto, no la intención.
3. **Smoke test en `release-desktop.yml`**, tras empaquetar y antes de subir a R2: un
   `GET /v1/check` real contra el Worker de producción, firmado con el `YCORE_CLIENT_SECRET`
   que se acaba de embeber. Si el Worker no acepta la firma, el secret de GitHub y el del
   Worker no coinciden y **el release se detiene ahí**. Es la única capa que puede detectar
   la desincronización del punto 2, y encaja en el pipeline actual sin tocar sus pasos.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| **Dejarlo como está** (`process.env` en runtime del usuario) | Es el bug. El proceso del usuario no hereda el entorno de CI. Garantiza que updates nunca funcione, en silencio, para siempre |
| **Hardcodear los tres valores en un `.ts` commiteado** | Rompe los dos requisitos del contexto: cualquier clon del repo se convierte en cliente de producción con el secreto de producción, y el valor deja de tener trazabilidad con el Worker desplegado (nadie sabe si el literal sigue coincidiendo con lo que hay en `wrangler secret`). Además es literalmente la duplicación de URL del v1 |
| **Un archivo `update-config.json` generado en build por un script de `tools/scripts/` y copiado a `out/main/` (como `copyMigrationsPlugin`)** | Fue la alternativa seria y se descarta por tres cosas: (a) mete **I/O y un modo de fallo nuevo** en el arranque (archivo ausente, JSON corrupto, `asar` que no lo incluye) donde `define` no tiene ninguno; (b) obliga a cambiar `update-scheduler.ts` de "leo env" a "leo y parseo un archivo con Zod", es decir más código en el camino crítico del arranque; (c) el JSON queda **legible y editable dentro del `asar`**: un usuario puede repuntar la app a otro Worker editando un archivo de texto, lo que convierte una config en una superficie de ataque de redirección de updates que hoy no existe. El precedente de las migraciones no aplica: los `.sql` son datos que Vite no puede empaquetar; tres cadenas sí puede |
| **`import.meta.env` + prefijo `VITE_`** | Trae la convención "todo lo `VITE_` es público y va al cliente" a un proceso que sostiene el secreto del HMAC, y obliga a reescribir el acceso ya existente. La ganancia es cero |
| **Meter los valores en `extraMetadata` / `build.env` de `electron-builder.yml`** | Acaba en el `package.json` empaquetado: texto plano trivialmente legible dentro del `asar`, con los mismos problemas del JSON generado y encima en un archivo que además se lee para otras cosas. Y no cubre `pnpm dev`, que no pasa por electron-builder |
| **Un `.env` commiteado con los valores de producción** (o un `.env.example` que los traiga) | Es hardcodear con otro nombre. `.gitignore` ya excluye `.env*` justamente para esto |
| **Degradar a inerte también en el build de release** (mantener el comportamiento actual en todos los contextos) | Un `.exe` de release sin updates es irreparable en campo: los usuarios que lo instalen no recibirán jamás el aviso de la versión que lo arregla, porque el mecanismo del aviso es el que falta. Es el caso exacto que justifica parar en CI. La garantía de runtime del ADR-0003 no se toca: sigue habiendo modo inerte para todo build que no sea de release |
| **Fallar el build siempre que falten las variables (también en dev y en PRs)** | Rompe `pnpm build` en cualquier PR y en cualquier máquina sin los secrets de producción, incluidos forks. Mismo criterio del ADR-0005: nada que necesite credenciales puede estar en el gate que corre en cada PR |
| **Usar `process.env.CI` para decidir si es obligatorio** | `CI` está en todos los PRs. Un flag explícito del workflow de release (`YCORE_REQUIRE_UPDATE_CONFIG=1`) hace que la exigencia sea visible en el YAML donde se toma la decisión, en vez de un efecto lateral |
| **Obtener la config en runtime desde un endpoint público del Worker** (bootstrap remoto) | Circular: para saber dónde está el Worker hay que preguntar al Worker. Y mover las claves públicas Ed25519 a algo que llega por red **destruye la cadena de confianza del ADR-0005**: la clave con la que verificas la firma no puede venir del mismo canal que el binario firmado |
| **`YCORE_CLIENT_SECRET` y `YCORE_MANIFEST_PUBLIC_KEYS` como GitHub *Variables* en vez de Secrets** | Serían visibles en texto plano en cada log de Actions. No son secretos criptográficos, pero exponerlos por defecto solo compra comodidad de depuración, y esa depuración se hace mejor con la huella del smoke test |
| **Ofuscar/cifrar los valores dentro del binario** | ADR-0005 punto 6 ya cerró que esto es ofuscación y se documenta como tal. Cifrarlos exigiría una clave en el mismo binario: teatro con pasos extra, y deuda técnica en el camino de arranque |

## Consecuencias

- **Positivas**:
  - La feature de updates **funciona en producción**, que hoy no es el caso. Todo lo
    construido por ADR-0003 y ADR-0005 pasa de inerte a operativo.
  - `update-scheduler.ts` no cambia: cero código nuevo en el camino de arranque, cero
    modos de fallo nuevos en runtime. El modo inerte sigue siendo la red de seguridad.
  - Un clon o fork del repo **no puede** apuntar por accidente a producción: sin los
    secrets, sale un binario inerte.
  - Un release defectuoso se detiene en CI en vez de llegar a usuarios que nunca podrían
    ser avisados del arreglo.
  - El smoke test contra el Worker real convierte "los secrets siguen sincronizados" en una
    propiedad verificada en cada release, no en algo que se recuerda.
  - Coste 0 €: `define` es Rollup, los Secrets son de GitHub, el smoke test es una request.

- **Negativas / lo que aceptamos pagar**:
  - **`pnpm dev` queda inerte por defecto.** Probar el ciclo real de updates exige crear un
    `.env.local` a mano. Aceptado y documentado; la alternativa es peor.
  - Los tres valores quedan **en texto plano dentro del `.exe`** y se extraen con `strings`.
    Ya estaba aceptado (ADR-0005 punto 6) y no lo empeora, pero conviene decirlo aquí: no
    se debe añadir una cuarta variable a este mecanismo sin comprobar antes que también es
    pública. El checker del punto 5.1 obliga a que cada clave nueva pase por ahí.
  - **Rotar `YCORE_CLIENT_SECRET` o las claves públicas obliga a publicar una versión de la
    app.** Ya era así por ADR-0005 (rotación con dos públicas simultáneas), pero ahora está
    fijado también en el build.
  - **Dos secrets nuevos que crear a mano en GitHub** antes del primer release que use esto,
    y una desincronización con el Worker posible entre `wrangler secret put` y el Secret de
    GitHub. Mitigado por el smoke test, no eliminado.
  - **El smoke test hace que un release dependa de que el Worker esté vivo.** Si Cloudflare
    está caído, no se publica. Es coherente con el ADR-0005 ("si GitHub Actions está caído,
    no se publica") y preferible a publicar a ciegas.
  - Un test que ejecuta un build real es **más lento** que un test unitario. Va con
    `timeout` holgado y es un solo test.

- **Qué habría que hacer para revertir esto**: quitar el `define` del config y los `env:`
  del workflow devuelve el repo al estado de hoy, es decir, al bug. Lo que **exigiría un
  ADR que reemplace a este** es cambiar el mecanismo (a archivo generado o a bootstrap
  remoto) o relajar el punto 4 dejando que un release se publique sin config: la primera
  cambia la superficie de ataque del arranque, la segunda reintroduce el fallo irreversible
  en campo. Ampliar el conjunto de tres a cuatro variables **no** requiere ADR nuevo, pero
  sí que la cuarta sea pública y pase por el checker.

## Cómo se verifica que se cumple

```
pnpm lint            # sin cambios de reglas: el config sigue bajo max-lines 400 y sin any.
                     # El define no introduce tipos nuevos.

pnpm typecheck       # sin cambios: update-scheduler.ts sigue leyendo string | undefined,
                     # asi que el modo inerte sigue siendo un camino tipado y alcanzable.

pnpm test            # test de integracion de build en apps/desktop:
                     #  - con las tres variables en el entorno, `electron-vite build` produce
                     #    un out/main/index.js que CONTIENE los tres valores literales
                     #    (marcadores ficticios, nunca los reales).
                     #  - sin ellas, out/main/index.js NO los contiene y el bundle conserva
                     #    el camino que devuelve null -> modo inerte.
                     #  - los literales NO aparecen en out/preload/index.js ni en el bundle
                     #    del renderer. Este es el que impide que el secreto del HMAC se
                     #    filtre al proceso que renderiza contenido.
                     #  - el test de service.test.ts "configuracion inerte" sigue pasando:
                     #    la garantia de runtime del ADR-0003 no se toca.

pnpm knip            # detecta un segundo camino de lectura de config de updates si alguien
                     # anade un loader de .env paralelo al define.

pnpm check:docs      # docs/02-features/updates/decisions.md debe describir el mecanismo, y
                     # docs/05-operations/release-process.md el procedimiento de secrets.

pnpm check:all       # incluye el checker nuevo de abajo.
```

Checkers **nuevos**, que se implementan junto con la decisión:

1. **`check:build-config`** (`tools/scripts/check-build-config.mjs`), añadido a
   `check:all` y al hook de pre-commit. Verifica, sobre
   `apps/desktop/electron.vite.config.ts` y `src/main/bootstrap/update-scheduler.ts`:
   - El conjunto de claves `YCORE_*` que `update-scheduler.ts` lee de `process.env` es
     **exactamente** el conjunto que aparece en el `define`. Ni más ni menos. **Este es el
     checker que impide repetir el bug de hoy**: hoy el desajuste era de tres a cero y nadie
     lo notó; con esto, añadir una variable al código y olvidarla en el build rompe el gate.
   - El `define` está en la sección `main` y **no** en `preload` ni en `renderer`.
   - El config **no contiene literales de producción**: falla si aparece `workers.dev`,
     `y-core.app`, o cualquier cadena base64 de 32+ bytes. Un fallback a producción escrito
     "temporalmente" no llega a commitearse.
   - Existe `apps/desktop/.env.example` con las tres claves y con los valores **vacíos**.
2. **Paso "Verificar que la config de updates quedó embebida"** en `release-desktop.yml`,
   entre `package:win` y la subida a R2. Dos comprobaciones:
   - Que `out/main/index.js` contiene el host de `YCORE_WORKER_URL`. Si no, el `define` no
     corrió con las variables presentes y el `.exe` es inerte: **el release para aquí**, sin
     subir nada a R2 ni registrar nada en D1.
   - **Smoke test contra el Worker real**: `GET /v1/check` con un `clientId` UUID v4 recién
     generado y `X-YCore-Signature` calculada con el `YCORE_CLIENT_SECRET` que se acaba de
     embeber. Se exige respuesta `200` y **que no se cuente como `rejected`** — recordando
     que por ADR-0005 punto 4 una firma mala también responde `200`, así que comprobar solo
     el código HTTP no verifica nada. Es la única forma de detectar que el Secret de GitHub
     y el de `wrangler secret put` se han desincronizado, y el `aprendizaje.md` del
     2026-08-27 ya documenta lo ciego que es depurar esto a mano.
3. **`YCORE_REQUIRE_UPDATE_CONFIG=1`** declarado en el paso de build de
   `release-desktop.yml`. Es el que hace que faltar una variable sea un fallo de build en el
   release y solo ahí. Sin él, ningún PR ni ningún `pnpm build` local necesita secrets.

Verificación manual, una sola vez y documentada en
`docs/05-operations/release-process.md` (fuera de `pnpm test`, requiere credenciales): crear
`YCORE_CLIENT_SECRET` y `YCORE_MANIFEST_PUBLIC_KEYS` en GitHub Secrets con los valores que
ya están en el Worker desplegado y en la clave Ed25519 generada, y comprobar en el primer
release real que el `.exe` instalado detecta una versión publicada — el ciclo de 6 pasos que
el ADR-0005 ya dejó escrito ahí.
