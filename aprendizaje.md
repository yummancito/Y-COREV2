# Aprendizaje — Y-CORE V2

Registro de errores detectados y resueltos durante el desarrollo. Cada entrada se añade en
cuanto el error se resuelve, no después. Ver la regla correspondiente en `.claude/CLAUDE.md`.

Formato de cada entrada:

```markdown
## AAAA-MM-DD — Título corto del problema

**Contexto:** qué se estaba haciendo.
**Error:** qué falló exactamente.
**Causa:** por qué falló, la razón de fondo, no el síntoma.
**Solución:** qué se hizo para arreglarlo.
**Cómo evitarlo:** qué regla o comprobación evita que vuelva a pasar.
```

Si un error se repite, la entrada existente no era lo bastante clara o no generó una
comprobación automática — se revisa la entrada, no solo el error.

---

## 2026-08-25 — El v1 (Y-CORE) acumuló ~90 `.md` contradictorios en la raíz

**Contexto:** al mapear `../Y-CORE` como referencia para portar algoritmos (parsers ACF/VDF,
detección de DRM) antes de tocar Y-CORE V2.

**Error:** la raíz de `Y-CORE` tiene decenas de archivos `.md` de auditoría, changelog y
resúmenes de implementación (`ARCHITECTURE_COMPLETE.md`, `FIXES_APPLIED.md`,
`DRM_REMOVER_PHASE4_*.md`, etc.) que se contradicen entre sí según la fecha en que se escribieron.

**Causa:** no había una regla que impidiera crear `.md` en la raíz, así que cada sesión de
trabajo dejó su propio informe suelto en vez de actualizar un documento vivo en `docs/`.

**Solución:** Y-CORE V2 prohíbe `.md` en la raíz salvo la allowlist (README, CONTRIBUTING,
LICENSE, SECURITY, CHANGELOG) — ver regla R2 en `.claude/CLAUDE.md`, verificada por
`tools/scripts/check-file-rules.mjs`.

**Cómo evitarlo:** el checker `check-file-rules.mjs` bloquea (`exit 2`) cualquier intento de
escribir un `.md` fuera de esa allowlist en la raíz. Los informes de auditoría se abren como
issue, nunca como archivo.

---

## 2026-08-25 — `pnpm-workspace.yaml` tenía `allowBuilds` a medio configurar

**Contexto:** al añadir `apps/web-landing` (Astro) e instalar dependencias con `pnpm install`,
necesarias para compilar y verificar el sitio.

**Error:** `pnpm install` terminaba con `[ERR_PNPM_IGNORED_BUILDS]` para `esbuild` y `sharp`
(dependencias nativas de Astro/Vite) y pedía correr `pnpm approve-builds`, que es interactivo
y no se puede automatizar desde un agente.

**Causa:** `pnpm-workspace.yaml` ya tenía una sección `allowBuilds` con los placeholders
literales `esbuild: set this to true or false` / `sharp: set this to true or false` sin
completar — quedó a medias de una sesión anterior.

**Solución:** completar `allowBuilds` con `esbuild: true` / `sharp: true` en
`pnpm-workspace.yaml`. (El intento inicial de arreglarlo con `pnpm.onlyBuiltDependencies` en
`package.json` no sirvió: pnpm 11 movió esa opción a `pnpm-workspace.yaml` y avisa con un
`[WARN]` si la encuentra en el sitio viejo.)

**Cómo evitarlo:** no dejar configuración a medias en archivos versionados — un placeholder
sin rellenar en `pnpm-workspace.yaml` bloquea el install de cualquiera que clone el repo.

---

## 2026-08-25 — `.describe()` de Zod v4 no estrecha el tipo estático

**Contexto:** al diseñar `packages/ipc-contract`, quería que `defineChannel` exigiera en
**tipos** que todo schema llevara `.describe()`, con un tipo `DescribedSchema = z.ZodType &
{ description: string }`.

**Error:** `tsc --noEmit` fallaba en cada uso real (`z.object({}).describe('x')` no era
asignable a `DescribedSchema`), aunque en runtime `description` sí estaba presente.

**Causa:** en Zod v4, `.describe()` devuelve el mismo tipo del schema (es una mutación con
`return this`), no un tipo nuevo con `description` obligatoria. No hay forma honesta de
exigir "está descrito" solo con el sistema de tipos de TS sobre la API pública de Zod.

**Solución:** `DescribedSchema` pasó a ser un alias simple de `z.ZodType` (sin exigir
`description` en el tipo). La garantía real de "todo canal está descrito" vive en
`assertContractIsFullyDescribed` (`packages/ipc-contract/src/assert-described.ts`), que
recorre el contrato en runtime y lanza si falta una descripción — se ejecuta una vez al
importar `packages/ipc-contract/src/index.ts`, así que un canal sin describir rompe el
proceso inmediatamente, no en silencio.

**Cómo evitarlo:** cuando una librería de terceros no estrecha tipos en una operación
encadenable (builder pattern con `return this`), no fingir esa garantía en TS — verificarla
en runtime en el punto de construcción y decirlo explícitamente en el comentario del tipo.

---

## 2026-08-25 — `check-file-rules.mjs` (R3/R5) se disparaba con menciones en comentarios

**Contexto:** al documentar `apps/desktop/src/main/ipc/registry.ts`, el TSDoc del módulo
explica en prosa que "una feature nunca escribe su propio `ipcMain.handle`" — el propio
texto que explica la regla.

**Error:** el hook bloqueó el archivo con R3, aunque no había ninguna llamada real a
`ipcMain.handle`: solo la mención en un comentario explicando qué NO hacer.

**Causa:** las reglas R3, R3b, R4 y R5 del checker corrían sus regex sobre el contenido
completo del archivo, sin distinguir comentarios/TSDoc de código real. Cualquier
documentación que mencionara los patrones prohibidos (para explicar la regla, como aquí)
disparaba un falso positivo — ya había pasado antes con `check-file-rules.mjs` y
`packages/eslint-config` analizándose a sí mismos, pero ahí lo resolví excluyendo archivos
enteros; esta vez el patrón aparecía en un archivo que sí debía revisarse por lo demás.

**Solución:** añadida `stripComments()` en `tools/scripts/check-file-rules.mjs`, que quita
comentarios `//` y `/* */` antes de aplicar los regex de R3/R3b/R4/R5. R6 (que busca
`eslint-disable`, siempre un comentario) sigue mirando el contenido sin filtrar. Es una
solución general — cualquier archivo puede ahora documentar en prosa una regla sin
autobloquearse — en vez de una lista de excepciones por ruta que hay que mantener.

**Cómo evitarlo:** un checker que hace pattern-matching de texto crudo sobre código fuente
debe distinguir comentarios de código desde el principio, no parchear cada archivo que
lo dispare. La exclusión de archivo completo (usada antes para el propio checker y
`packages/eslint-config`) sigue siendo necesaria ahí porque esos archivos usan los
patrones dentro de *strings*, no de comentarios — `stripComments` no los cubre.

---

## 2026-08-25 — La regla ESLint `no-raw-ipc` se bloqueaba a sí misma en router.ts/preload

**Contexto:** al escribir el router real (`apps/desktop/src/main/ipc/router.ts`, que SÍ debe
llamar `ipcMain.handle`) y el preload real (que SÍ debe llamar `ipcRenderer.invoke`).

**Error:** `pnpm lint` fallaba en ambos archivos con la propia regla `no-raw-ipc` que se
supone debía permitirles existir — exactamente los dos únicos archivos del repo donde esas
llamadas son correctas.

**Causa:** `noRawIpcRule()` en `packages/eslint-config/rules-de-ipc-y-tipos.js` devolvía un
único objeto de reglas (`no-restricted-syntax` con dos selectores) que se aplicaba sin
distinción a `**/*.{ts,tsx}` — no había ningún `ignores` que exceptuara al router o al
preload de su propia regla.

**Solución:** `noRawIpcRule` pasó a llamarse `noRawIpcConfigs` y devuelve dos bloques de
ESLint 9 flat config independientes, cada uno con su propio `ignores`: el bloque que
prohíbe `ipcMain.handle` excluye `**/main/ipc/router.ts`; el que prohíbe `ipcRenderer.*`
excluye `**/preload/**`. `index.js` los agrega como entradas separadas del array de config,
no como un `rules` fusionado.

**Cómo evitarlo:** una regla de "prohibido X en todo el árbol" que existe justamente porque
hay UN lugar donde X es correcto necesita su excepción declarada desde el primer commit de
la regla, no como parche posterior — probarla contra el propio caso permitido (aquí:
escribir el router real) habría detectado esto antes de que hubiera código que lo disparara.

---

## 2026-08-25 — commitlint rechaza "Fase 1" en el subject por sentence-case

**Contexto:** al commitear el cierre de la Fase 1, con subject
`feat(desktop): Fase 1 -- contrato IPC, router unico, preload sin invoke generico`.

**Error:** el hook `commit-msg` rechazó el commit con `subject must not be sentence-case,
start-case, pascal-case, upper-case [subject-case]`.

**Causa:** `@commitlint/config-conventional` exige `subject-case` en minúsculas
(`lower-case`); "Fase 1" con F mayúscula bastó para que lo detectara como sentence-case.

**Solución:** cambiar a `fase 1` en minúsculas dentro del subject. La regla es correcta y
no se toca — mantiene los mensajes de commit consistentes en el historial.

**Cómo evitarlo:** en Conventional Commits, el subject (después de `tipo(scope): `) va
siempre en minúsculas, incluidas palabras que normalmente se capitalizarían como nombres
propios del proyecto ("Fase 1", "ADR-0002"); esas van bien en el cuerpo del mensaje, no en
el subject.

---

## 2026-08-25 — `vite-plugin-static-copy` no copiaba archivos con electron-vite + Vite 7

**Contexto:** al conectar `main/db/migrations` (archivos `.sql`/`.json` generados por
drizzle-kit) al build de producción de `apps/desktop`, para que
`main/bootstrap/database.ts` los encuentre en `out/main/db/migrations` y no solo en
`src/` (que en producción no existe).

**Error:** `vite-plugin-static-copy@4.1.1` se registraba correctamente en la config de
`electron-vite` (confirmado con `DEBUG=vite:*`: el plugin aparece en la lista con su hook
`writeBundle` presente), pero después de `pnpm build` la carpeta `out/main/db/` no
contenía nada — ni con ruta relativa (`'src/main/db/migrations'`) ni con ruta absoluta
(`resolve(__dirname, ...)`).

**Causa:** no confirmada con certeza (el plugin no da ningún error ni log), pero el
patrón encaja con un problema conocido de plugins que dependen de `writeBundle` cuando
electron-vite construye el proceso main como un "SSR environment" de Vite 7 — el hook
puede no dispararse en ese modo para todos los plugins de terceros.

**Solución:** se abandonó `vite-plugin-static-copy` y se reemplazó por un plugin propio de
una función (`copyMigrationsPlugin` en `electron.vite.config.ts`) que usa `cpSync` de
`node:fs` directamente en su propio hook `closeBundle`. Verificado con un build real:
`out/main/db/migrations/0000_tricky_gambit.sql` y `meta/*.json` aparecen correctamente.

**Cómo evitarlo:** para algo tan simple como "copiar una carpeta después del build", un
plugin de una función propia con `cpSync` es más fiable y más fácil de depurar que una
dependencia externa cuyo comportamiento con el modo SSR environments de Vite 7 no está
verificado. Reservar plugins de terceros para necesidades más complejas (glob patterns,
watch mode en dev, etc.) que sí justifiquen la dependencia.

---

## 2026-08-25 — `spawn()` con ejecutable inexistente falla de forma asíncrona en Windows

**Contexto:** al escribir `main/platform/process-launcher.ts` (`spawnDetached`), que lanza
el ejecutable de un juego y devuelve `Result<{ pid }, AppError>` de forma síncrona.

**Error:** el test con un ejecutable inexistente (`C:\ruta\que\no\existe\nunca.exe`)
producía un `Unhandled Error` de Vitest — un `ENOENT` no capturado escapaba del `try/catch`
de `spawnDetached` y se propagaba como excepción global del proceso.

**Causa:** en Windows, `child_process.spawn()` con un ejecutable que no existe NO lanza de
forma síncrona: crea el objeto `ChildProcess` normalmente y emite el evento `'error'` de
forma asíncrona un instante después. El `try/catch` de `spawnDetached` solo puede capturar
fallos síncronos — el ENOENT llegaba fuera de esa ventana y no tenía ningún listener que lo
absorbiera, así que Node lo trataba como una excepción no manejada.

**Solución:** añadido `child.on('error', ...)` en `spawnDetached` que registra el fallo
tardío con el logger en vez de dejarlo sin manejar. El `Result` síncrono ya se devolvió al
llamador para ese momento (con éxito si el SO aceptó el spawn, como pasó en este caso) — no
hay forma de "revocar" esa respuesta, así que el fallo asíncrono solo se puede registrar,
nunca convertir en el `AppError` que ve el llamador original.

**Cómo evitarlo:** cualquier wrapper sobre una API de Node que emite eventos async de error
(`child_process`, streams, sockets) necesita su propio listener de `'error'` — un
`try/catch` alrededor de la llamada que lo crea NUNCA es suficiente. Verificado con un test
real (ejecutable inexistente de verdad), no un mock — un mock de `spawn` no habría
reproducido este comportamiento asíncrono específico de Windows.

---

## 2026-08-25 — `environmentMatchGlobs` de Vitest fue removido en la v4

**Contexto:** al configurar `apps/desktop/vitest.config.ts` para que los tests de
`src/main/**` corran en entorno `node` y los de `src/renderer/**` en `jsdom` (main usa DB
real y `spawn`; el renderer necesita DOM para React Testing Library).

**Error:** con `environmentMatchGlobs: [['src/renderer/**', 'jsdom']]`, todos los tests del
renderer fallaban con `ReferenceError: document is not defined` — como si `jsdom` nunca se
hubiera aplicado.

**Causa:** `environmentMatchGlobs` era una opción de Vitest 1-2 y fue removida en Vitest 4
(el paquete instalado es `vitest@4.1.10`) sin dejar rastro en los `.d.ts` — TypeScript no
marcó error porque el config no está tipado estrictamente contra ese campo específico, así
que el typo silencioso pasó desapercibido hasta correr los tests.

**Solución:** reemplazado por `test.projects` (la API de Vitest 4 para configs
multi-entorno dentro de un mismo archivo): dos proyectos (`main` con `environment: 'node'`
e `include: ['src/main/**/*.test.ts', ...]`, `renderer` con `environment: 'jsdom'` e
`include: ['src/renderer/**/*.test.{ts,tsx}']`), cada uno con `extends: true` para heredar
la config base (plugins, etc.).

**Cómo evitarlo:** cuando una opción de config de una librería con versiones mayores
frecuentes (Vitest, Vite) no produce ningún error de tipos raro pero tampoco funciona,
sospechar que fue removida/renombrada entre versiones — grepear los `.d.ts` instalados
directamente por el nombre del campo confirma si existe en la versión real instalada, en
vez de confiar en documentación o memoria de versiones anteriores.

---

## 2026-08-25 — Un spread superficial de `window` rompe jsdom en tests

**Contexto:** al mockear `window.ycore` en los tests del renderer (hooks y componentes que
llaman `window.ycore.library.*`), usando `vi.stubGlobal('window', { ...globalThis.window,
ycore: fake })`.

**Error:** los tests fallaban con `TypeError: Expected container to be an Element, a
Document or a DocumentFragment but got undefined` dentro de `waitFor` — como si
`document`/`document.body` hubiera desaparecido a mitad del test.

**Causa:** `{ ...globalThis.window }` hace un spread superficial que copia las propiedades
**propias y enumerables** de `window` a un objeto plano nuevo. En jsdom, `document` (y
otros miembros de `Window`) no son propiedades de datos simples sino accessors definidos en
el prototipo de `Window` — un spread no los copia. El objeto resultante que
`vi.stubGlobal('window', ...)` instalaba como `globalThis.window` ya no era un `Window` de
verdad: perdía su prototipo y todos sus getters, así que cualquier código que leyera
`window.document` después obtenía `undefined`.

**Solución:** en vez de reemplazar `window` completo, usar `Object.assign(window, {
ycore: fake })` — modifica el objeto `window` real de jsdom in-place, añadiendo solo la
propiedad necesaria, sin tocar su prototipo ni sus accessors existentes.

**Cómo evitarlo:** nunca reconstruir un objeto host (`window`, `document`, cualquier cosa
provista por el entorno, no por el propio código) con spread — un objeto host casi siempre
tiene comportamiento en su prototipo (getters, setters, métodos nativos) que un spread
plano no reproduce. Mutar la propiedad específica que hace falta, no reemplazar el objeto
completo.

---

## 2026-08-25 — Tres bugs reales al intentar abrir la ventana de Electron por primera vez

**Contexto:** al verificar de extremo a extremo que `apps/desktop` abre una ventana real
(criterio informal de "la app funciona", más allá de que los tests pasen). Se encontraron
tres problemas encadenados, cada uno enmascarando al siguiente.

### 1. `"type": "module"` rompía la interop CJS de better-sqlite3

**Error:** `TypeError: Cannot read properties of undefined (reading 'exports')` en
`cjsPreparseModuleExports` al arrancar.

**Causa:** `apps/desktop/package.json` tenía `"type": "module"`, así que electron-vite
compilaba main/preload como ESM (`format: 'es'`, derivado directamente de `pkg.type` — ver
`electron-vite/dist/chunks/lib-*.js`). `better-sqlite3` es un addon nativo CJS; la interop
Node ESM→CJS con un addon nativo específicamente falla en ese paso de preanálisis.

**Solución:** quitar `"type": "module"` de `apps/desktop/package.json`. electron-vite
compila entonces main/preload como CJS (su formato por defecto), mucho más compatible con
dependencias nativas. El renderer (React, vía Vite aparte) no se ve afectado.

### 2. `externalizeDepsPlugin()` dejaba los paquetes del workspace sin transpilar

**Error:** tras arreglar (1), `SyntaxError: Unexpected token 'export'` en
`packages/logger/src/index.ts` al arrancar.

**Causa:** `externalizeDepsPlugin()` externaliza automáticamente TODAS las
`dependencies` del `package.json`, incluidos los paquetes del propio workspace
(`@ycore/logger`, etc.), que exportan `.ts` directo (pensado para que Vite los transpile
al consumirlos, no para que Node haga `require()` de ellos tal cual).

**Solución:** `externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })` en
`electron.vite.config.ts`, con la lista de paquetes `@ycore/*` — así se bundlean dentro
de `out/main`/`out/preload` en vez de quedar como `require()` externo.

### 3. El prebuild de better-sqlite3 es para la ABI de Node, no la de Electron

**Error:** tras arreglar (1) y (2), la app abre sin errores de JS, pero el proceso
Electron muere en silencio (sin excepción capturable, sin log de Windows) exactamente en
`new Database(dbPath)`.

**Causa:** `node_modules/better-sqlite3/prebuilds/win32-x64.node` es el prebuild que
`npm`/`pnpm` descarga por defecto — compilado contra la ABI de Node normal
(`process.versions.modules`), no la de Electron (Electron 33 embebe Node 20, ABI 130,
distinta a la del Node del sistema en esta máquina, ABI 137). `better-sqlite3` usa N-API
(ABI estable entre versiones), pero el prebuild de fábrica sigue sin ser el correcto para
Electron — necesita su propio rebuild con `@electron/rebuild`.

Complicación adicional: `better-sqlite3`'s `binding.gyp` tiene
`'prebuild_exists%': '<!(node lib/binding.js)'` — si YA existe cualquier prebuild
(aunque sea el de Node), `node-gyp rebuild` genera un proyecto vacío que "compila" en
menos de 3 segundos sin tocar ningún `.cc` fuente y reporta éxito falso. Hubo que borrar
el prebuild existente para forzar una compilación real.

**Solución:** dos scripts en `apps/desktop/tools/`:
- `rebuild-native-for-electron.mjs` — respalda el prebuild de Node en
  `win32-x64.node-abi.node`, lo esconde, corre `electron-rebuild --build-from-source`, y
  copia el resultado a `win32-x64.node` (activo) y `win32-x64.electron-abi.node` (backup).
- `rebuild-native-for-node.mjs` — restaura el backup de Node al activo.

`pnpm dev`/`pnpm build` corren el primero automáticamente; `pnpm test`/`pnpm
check:contract` corren el segundo (los tests usan SQLite real bajo Node vía Vitest, no
pueden compartir binding con la app real bajo Electron).

**Requiere Visual Studio Build Tools (workload C++) instalado y el script corriendo desde
un entorno con `vcvars64.bat` cargado** (Developer Command Prompt/PowerShell) — sin eso,
`node-gyp` no encuentra `cl.exe`/`link.exe` y el build "reporta éxito" sin compilar nada
(mismo síntoma de éxito falso que el problema del prebuild existente, causa distinta).

### Lo que quedó sin resolver en este entorno concreto

Incluso con el binding recompilado y confirmado ABI 130 (correcto para Electron) en
runtime (`process.versions.modules: 130` verificado dentro del propio proceso Electron),
`new Database(':memory:')` sigue matando el proceso sin generar ningún log de Windows
(Event Viewer, WER) ni excepción de JS. Se aisló hasta confirmar: Electron real funciona
(`BrowserWindow` con `data:` URL abre, `did-finish-load`/`ready-to-show` disparan,
`isVisible: true`); `better-sqlite3` con el binding de Electron carga y funciona
perfectamente bajo Node puro; pero el mismo binding, dentro del mismo proceso Electron
real, crashea específicamente al inicializar la conexión SQLite. No se pudo diagnosticar
más allá con las herramientas disponibles en este sandbox (sin WinDbg ni acceso a dumps
de proceso). Es un problema del entorno de este sandbox, no del código — pendiente de
verificar en una máquina de desarrollo real sin las restricciones de este entorno.

**Cómo evitarlo / próximo paso:** en la máquina real del usuario, correr
`pnpm --filter @ycore/desktop dev` tras instalar Visual Studio Build Tools. Si el mismo
crash silencioso ocurriera ahí también, el primer paso de diagnóstico sería un dump de
proceso real (Process Explorer con "Create dump" al crashear, o `--enable-crashpad` con
un servidor de crash reports local) — herramientas que este sandbox no expone.

**Reconfirmado en sesión posterior (mismo día):** se repitió el intento con el mismo
resultado exacto — build limpio, binding recompilado y verificado (ABI 130), el proceso
Electron muere en el mismo punto sin logs. Hallazgo adicional: procesos `electron.exe`
zombie de una sesión de debug anterior (dejados corriendo en background sin matar
correctamente) confundieron el diagnóstico inicial al aparecer como "procesos vivos" en
`Get-Process` — verificar siempre `CommandLine` vía `Get-CimInstance Win32_Process` para
confirmar que un proceso encontrado es realmente el lanzamiento actual y no un sobrante,
antes de interpretar su estado como señal de progreso.

---

## 2026-08-25 — `parseVdf` no detectaba llaves de sección sin cerrar

**Contexto:** al escribir `packages/steam-kit/src/vdf/parse-vdf.ts` (Fase 3), el test
"devuelve AppError io.failed ante llaves desbalanceadas" (`'"key"\n{\n\t"a" "b"\n'`, sin
`}` final) fallaba: el parser devolvía `ok(...)` en vez de `err(...)`.

**Error:** `parseChildren` trataba "se acabaron los tokens" igual que "encontré la llave
de cierre" — en ambos casos retornaba los children acumulados sin distinguir el caso.

**Causa:** la condición `if (token === undefined || token.type === 'brace-close')`
combinaba dos situaciones muy distintas: llegar al final del archivo en el nivel raíz
(correcto, ahí no hay ninguna llave de apertura que cerrar) y llegar al final del
archivo dentro de una sección anidada sin haber visto su `}` correspondiente (un
archivo corrupto de verdad).

**Solución:** separar los dos casos — si `token === undefined` y `depth > 0`, lanzar
explícitamente ("llave de sección sin cerrar"); si `depth === 0`, es el fin normal del
árbol de nivel superior.

**Cómo evitarlo:** cuando una función recursiva de parseo comparte el mismo camino de
salida para "caso final válido" y "caso de error", verificar con un test que fuerce
exactamente la condición de error (aquí: EOF dentro de una sección abierta) — el caso
feliz (EOF en la raíz) es el que se prueba por accidente casi siempre, y enmascara el
bug hasta que alguien pasa un archivo real corrupto.

---

## 2026-08-25 — `parseDepotKeys` no encontraba la sección `depots` real de `config.vdf`

**Contexto:** al escribir `packages/steam-kit/src/depot-keys.ts` (Fase 3), con un
fixture de test que modela la jerarquía real de `config.vdf`
(`InstallConfigStore > Software > Valve > Steam > depots`).

**Error:** el test "extrae varias claves de depot desde la forma real anidada bajo
Steam" fallaba — `result.value.get('731')` devolvía `undefined`.

**Causa:** la función buscaba `Steam` (y luego `depots` dentro) solo en el **nivel
raíz** del árbol VDF, asumiendo una jerarquía plana. El `config.vdf` real de Steam
anida `Steam` cuatro niveles más abajo (`InstallConfigStore > Software > Valve >
Steam`), así que `findChild(root, 'Steam')` nunca lo encontraba.

**Solución:** `findDepotsSection()` busca la sección `depots` recursivamente en
cualquier profundidad del árbol (acotada por el mismo límite de 64 niveles que usa el
propio parser), en vez de asumir una ruta fija — la ruta intermedia
(`InstallConfigStore/Software/Valve`) no es parte del contrato real que a Y-CORE le
importa, solo el nombre de la sección `depots` en sí, que es único y no ambiguo.

**Cómo evitarlo:** al escribir el fixture de test con la jerarquía real de un archivo
real (no una versión simplificada "solo con lo que el código actual busca"), el test
detecta cuando el código asume una estructura más plana de la que el formato real
tiene — escribir el fixture primero, verificando contra documentación/muestras reales
del formato, habría prevenido este bug antes de escribir la función.

## 2026-08-25 — `chokidar` con un glob de archivo no funciona (y a veces crashea) en Windows

**Contexto:** al escribir `main/features/steam/watcher.ts` (cierre de Fase 3), vigilando
`<steamapps>/appmanifest_*.acf` en cada carpeta de biblioteca para re-importar la
biblioteca automáticamente cuando Steam instala/actualiza/desinstala un juego.

**Error:** dos fallos distintos según la ruta vigilada. (1) Bajo `os.tmpdir()` (que en
esta máquina resuelve a una ruta con nombre corto 8.3, `C:\Users\USERUN~1\...`), el
proceso de Node moría con `Assertion failed: !_wcsnicmp(filename, dir, dirlen), file
src\win\fs-event.c` — un crash del propio binding nativo de libuv, no una excepción JS
capturable. (2) Bajo una ruta larga normal (dentro del repo), no crasheaba pero tampoco
disparaba ningún evento `add`/`change` — el test se colgaba hasta el timeout.

**Causa:** se le pasaba a `chokidar.watch()` un patrón glob (`dir + '/appmanifest_*.acf'`)
en vez de una ruta de directorio. En Windows, el matcher de globs de chokidar 4
(picomatch) no conecta bien con el watcher nativo de archivos: no arma la suscripción de
eventos correctamente sobre un patrón de archivo, y si la ruta de base resuelve a un
nombre corto 8.3, el propio binding de libuv revienta al comparar el nombre canónico
contra el corto (bug de la capa nativa, no de chokidar en sí).

**Solución:** `startSteamLibraryWatcher` vigila el **directorio** `steamapps` completo
(`depth: 0`, sin descender a subcarpetas) en vez de un glob de archivo, y filtra por
nombre (`/^appmanifest_\d+\.acf$/`) dentro del callback de `add`/`change`/`unlink`. Se
verificó con un script aislado (`chokidar.watch(dir, {depth:0})` sí dispara eventos de
forma fiable en Windows; `chokidar.watch(dir + '/*.ext')` no).

**Cómo evitarlo:** en este repo, cualquier uso futuro de `chokidar` (u otro watcher de
archivos) en Windows vigila directorios, nunca patrones glob de archivo — filtrar por
nombre en el handler es más barato que depurar un watcher que no dispara o que crashea
el proceso según la ruta de la máquina. Si hace falta reproducir el bug del crash, basta
con vigilar una ruta bajo `os.tmpdir()` con un glob.

## 2026-08-25 — El test del watcher escribía el archivo antes de que chokidar estuviera listo

**Contexto:** al arreglar el bug anterior (vigilar el directorio en vez de un glob), el
test seguía sin detectar el evento `add` — ni un crash ni un log de error, simplemente
nada, hasta el timeout de 10 s.

**Error:** el test escribía el ACF inmediatamente después de que
`startSteamLibraryWatcher()` devolviera, pero `chokidar.watch()` hace un crawling inicial
asíncrono del directorio antes de que sus listeners de eventos estén realmente activos
(evento `ready`). El archivo se creaba durante esa ventana y su evento `add` se perdía.

**Solución:** `startSteamLibraryWatcher` ahora espera el evento `ready` de chokidar antes
de devolver la función `stop()` — la llamada no se considera "arrancada" hasta que el
watcher puede garantizar que no se pierde ningún evento posterior.

**Cómo evitarlo:** cualquier código (de producto o de test) que dependa de un watcher de
archivos recién creado debe esperar su señal de "listo" antes de asumir que está
vigilando — nunca asumir que `watch()` es síncrono ni que el primer evento después de
llamarlo se va a capturar.

## 2026-08-25 — `fetch`/`Response`/`ReadableStream` no tipaban en `main/`, aunque Node los expone en runtime

**Contexto:** al escribir `main/features/downloads/http-client.ts` (Fase 4, ADR-0004),
usando el `fetch` global de Node/undici para el cliente HTTP de descargas — cero
dependencias nuevas, según el ADR.

**Error:** `tsc` fallaba con `Cannot find name 'HeadersInit'` y ESLint marcaba
`no-unsafe-assignment` en `response = await fetch(...)`: TypeScript trataba `fetch` como
`any` implícito, a pesar de que Node 20+ lo expone como global real y el código corría
sin problema.

**Causa:** `apps/desktop/tsconfig.node.json` declara `"types": ["electron-vite/node"]`
explícitamente. En TypeScript, declarar `compilerOptions.types` **desactiva la
auto-inclusión de `@types/node`** (el comportamiento por defecto sin ese campo): sin
`@types/node` cargado, no hay declaraciones de `fetch`, `Response`, `Headers`,
`ReadableStream`, etc., aunque el runtime sí los tenga.

**Solución:** se añadió `"node"` a la lista: `"types": ["node", "electron-vite/node"]`.

**Cómo evitarlo:** cualquier `tsconfig.json` de este repo que declare `compilerOptions.
types` explícitamente debe incluir `"node"` en la lista si el código corre bajo Node
(main, preload, scripts) — de lo contrario los globals de Node (no solo `fetch`: también
`Buffer`, `process`, etc., aunque esos ya funcionaban por importarse indirectamente) caen
en `any` sin ningún error obvio hasta que se usa una API que TypeScript no puede resolver
de ningún otro lado.

## 2026-08-25 — `resumeInterrupted()` intentaba la transición imposible `downloading -> downloading`

**Contexto:** al escribir `DownloadService.resumeInterrupted()` (`main/features/downloads/
service.ts`, Fase 4), el gancho de bootstrap que retoma una descarga que quedó a mitad
tras un `kill -9` — la fila sigue en `downloading` en la DB porque nadie llamó a
`pause()` antes de morir.

**Error:** al reanudar, `download()` siempre llamaba `moveTo(state, { status:
'downloading', ... })` para persistir el nuevo `bytesDownloaded`/`bytesTotal` recién
abiertos. Cuando `state.status` ya era `'downloading'` (el caso de
`resumeInterrupted()`, a diferencia de una reanudación desde `paused`),
`transition()` rechazaba la transición `downloading -> downloading` con
`download.invalid-transition` — correctamente, según `ALLOWED_TRANSITIONS`
(ADR-0004, punto 2): no tiene sentido que un estado transicione a sí mismo.

**Causa:** la función `download()` no distinguía "vengo de `paused`" de "vengo de
`downloading` porque el proceso murió a mitad" — en ambos casos hay que calcular el
offset de reanudación igual, pero solo el primero es una transición real de estado.

**Solución:** si `state.status` ya es `'downloading'`, se persiste el nuevo
`bytesDownloaded`/`bytesTotal` con `repository.save()` directo (sin pasar por
`transition()`, porque no hay cambio de estado, solo de datos dentro del mismo
estado); si no, sigue pasando por `moveTo()`/`transition()` como siempre.

**Cómo evitarlo:** al diseñar cualquier operación que "reanuda" algo, comprobar
explícitamente contra la tabla de transiciones si el estado de origen puede ser igual
al de destino — una máquina de estados que solo permite transiciones estrictas (nunca
`X -> X`) necesita un camino aparte para "seguir en el mismo estado con datos
actualizados", y ese camino no es un bug, es una decisión de diseño que hay que hacer
explícita en el código (con su comentario), no un caso que se cuela sin querer.

## 2026-08-25 — Los tests de un servicio con trabajo fire-and-forget dejaban "unhandled rejection"

**Contexto:** al testear `DownloadService`, cuyo `enqueue()` dispara `run()` (el ciclo
completo de descarga) sin esperarlo (`void this.run(id)` — el IPC debe responder en
cuanto la fila queda `queued`, no cuando termina de descargar).

**Error:** `vitest` reportaba un "Unhandled Rejection" — `TypeError: The database
connection is not open` — en un test que ni siquiera esperaba a que terminara: el test
llamaba `service.enqueue()` dos veces (para probar `download.duplicate`) y terminaba
inmediatamente sin esperar nada más. El `afterEach` cerraba la DB y el servidor HTTP de
prueba justo después. La primera descarga (con un hash inventado, solo para ocupar el
slot del `appId`) seguía corriendo en segundo plano, y al intentar `fetch` o
`repository.save()` contra recursos ya cerrados, lanzaba.

**Causa:** cualquier test que llama a un método fire-and-forget dispara trabajo
asíncrono que sigue vivo después de que el `it` termine, salvo que el test
explícitamente espere a que ese trabajo llegue a un estado terminal. El test pasaba
igual (la aserción que importaba ya se había cumplido), pero el trabajo de fondo
seguía corriendo hacia una DB que el siguiente `afterEach` cerraba a mitad.

**Solución:** todo test que llama a `enqueue()` (incluso si lo que testea es otra cosa,
como el rechazo por duplicado) añade un `vi.waitFor()` esperando a que la descarga real
llegue a un estado terminal (`done` o `failed`) antes de terminar el `it`, para que no
quede ningún trabajo async pendiente cuando `afterEach` cierra la DB y el servidor.

**Cómo evitarlo:** al testear cualquier método fire-and-forget (`void algo()`), el test
tiene que esperar explícitamente a que ese trabajo termine (con polling del estado
observable, aquí `service.list()`) antes de devolver el control — nunca asumir que
porque la aserción principal ya pasó, no queda nada corriendo de fondo.

## 2026-08-25 — El test del límite de ancho de banda no frenaba nada, por contenido demasiado compresible

**Contexto:** al testear que `DownloadService` aplica de verdad el `TokenBucket`
(ADR-0004, punto 1) al escribir el archivo descargado — un test que arma un ZIP con un
`appmanifest`/contenido de prueba y espera que, con un límite bajo de bytes/segundo, la
descarga tarde perceptiblemente más.

**Error:** el test pasaba "demasiado rápido" (67 ms) con un límite de 500 B/s sobre un
archivo de 2000 bytes — matemáticamente debería haber tardado varios segundos.

**Causa:** el contenido de prueba era `'x'.repeat(2000)` — 2000 bytes idénticos. DEFLATE
(el algoritmo que usa el formato ZIP) comprime eso a ~17 bytes reales. El "archivo de
2000 bytes" nunca existió en la red: lo que viajaba por el `TokenBucket` cabía entero
dentro del burst inicial (el bucket arranca lleno, `tokens = bytesPerSecond`), así que
nunca llegó a frenar nada — el test medía la velocidad de un archivo casi vacío, no la
del escenario que quería probar.

**Solución:** se generó el contenido de prueba con `randomBytes(2000)` (incompresible
por definición) en vez de un string repetido, para que el tamaño real transmitido
coincidiera con el tamaño nominal del test.

**Cómo evitarlo:** cualquier test que mida throughput, tiempo de transferencia, o
tamaño de payload contra un formato con compresión (ZIP, gzip, brotli...) debe usar
contenido de prueba **incompresible** (aleatorio), nunca un string repetido o un patrón
simple — de lo contrario el tamaño "nominal" del fixture y el tamaño real que viaja por
la red pueden diferir en órdenes de magnitud, y el test mide algo distinto de lo que
cree medir.

## 2026-08-25 — El test del límite de ancho de banda pasaba aislado y fallaba dentro de `pnpm check:all`

**Contexto:** el mismo test de `TokenBucket` real (arriba) pasaba siempre ejecutado
solo (`npx vitest run service-bandwidth.test.ts`), pero fallaba de forma intermitente
al correr `pnpm check:all` completo (~112 tests de `apps/desktop` corriendo en la misma
tanda).

**Error:** el `vi.waitFor(..., { timeout: 10000 })` que esperaba a que la descarga
limitada a 500 B/s llegara a `done` expiraba y el estado real seguía en `downloading`
o pasaba a `failed` por el signal de aborto de otro test — el proceso, bajo la carga de
correr toda la suite (48 archivos, DB real, servidores HTTP reales, timers reales del
`TokenBucket`), tardaba más en programar los `setTimeout` del throttling que en
aislado.

**Causa:** un timeout de test calculado para el caso aislado no deja margen para la
contención de CPU/event-loop cuando corre junto a decenas de otros tests con I/O real
(sockets, disco, timers). El test en sí era correcto — medía lo que debía medir — pero
el presupuesto de tiempo era demasiado ajustado para el entorno real de CI/`check:all`.

**Solución:** se subió el timeout de `vi.waitFor` a 30 s y el timeout del `it` a 35 s
(muy por encima de lo que tarda en aislado), y se redujo el tamaño del contenido de
prueba de 2000 a 1500 bytes aleatorios — el margen que importa es la aserción de tiempo
mínimo (`> 1000 ms`), no cuánto tarda el `waitFor` en sí.

**Cómo evitarlo:** cualquier test que dependa de timers reales (rate-limiting, retries
con backoff, debounce) debe dimensionar sus timeouts pensando en "toda la suite
corriendo junta bajo carga", no en "este archivo solo" — y siempre correr `pnpm
check:all` completo al menos una vez antes de dar por cerrada una pieza que toque
timers reales, no solo el archivo de test aislado.

## 2026-08-26 — Medir tiempo de reloj real para verificar el `TokenBucket` seguía siendo frágil; y un `async function*` como sink de `pipeline()` colgaba

**Contexto:** tras subir los timeouts del test de ancho de banda a 30-35 s (entrada
anterior), `pnpm check:all` completo siguió fallando ese mismo test — y además empezó a
fallar `service.test.ts` (el ciclo feliz sin límite), que nunca había fallado antes.

**Error:** con la suite completa (56 archivos, 134 tests) corriendo junta, el test de
ancho de banda tardaba más de 30 s en algo que en aislado tarda ~3 s, y el test del
ciclo feliz (sin ningún límite de por medio) superaba el timeout **default de Vitest,
5000 ms**, que no estaba configurado explícitamente en ningún lado.

**Causa real, dos partes:** (1) el proyecto `main` de `vitest.config.ts` no tenía
`testTimeout` configurado, así que cualquier test con I/O real (servidor HTTP, SQLite)
dependía del default de 5 s — insuficiente bajo la contención de CPU de correr toda la
suite junta, sin que hiciera falta ningún bug de producto. (2) Al reescribir el test de
ancho de banda para no depender de tiempo de reloj (ver decisión de abajo), un primer
intento usaba un `async function*` como último argumento de `pipeline()` para
capturar los chunks emitidos; ese patrón colgaba indefinidamente (probado: 20 s de
timeout, cero avance) — un problema real de backpressure entre el generator y el
`Transform` anterior en la cadena, no relacionado con el `TokenBucket` en absoluto.

**Solución:** se añadió `testTimeout: 20000` al proyecto `main` de `vitest.config.ts`
(un valor generoso pensado para "toda la suite corriendo junta", no para el archivo
aislado). Y el test de ancho de banda se reescribió para no medir tiempo de reloj en
absoluto: en vez de correr el ciclo completo de `DownloadService` y comparar cuánto
tarda, se exportó `createThrottledPassThrough` (antes privada de `service.ts`) y se
testeó como un `Transform` puro, capturando sus chunks con el patrón estándar
`transform.on('data', ...)` seguido de `await pipeline(source, transform)` — sin
generator como sink. La aserción pasó de "tarda más de X ms" a "un chunk que supera el
cupo del bucket sale dividido en más de un `push()`", que es determinista y no depende
de reloj real ni de cuánta CPU haya libre.

**Cómo evitarlo:** nunca verificar un límite de tasa/ancho de banda midiendo tiempo de
reloj real en un test — bajo la carga de una suite completa el tiempo real es
inherentemente no determinista. Verificar el *comportamiento* (cuántos tokens concede,
en cuántos trozos se parte un chunk) contra la pieza aislada más pequeña que lo
implementa, con reloj inyectado si aplica. Y al capturar el output de un stream de
Node para aserciones, preferir `stream.on('data', ...)` + `pipeline(source, stream)`
sobre un `async function*` como sink — el segundo puede interactuar mal con el
backpressure de un `Transform` intermedio y colgar sin ningún mensaje de error útil.

## 2026-08-26 — `@cloudflare/vitest-pool-workers` 0.2x ya no usa `defineWorkersConfig` de `/config`

**Contexto:** al montar `services/update-worker` (Fase 5, ADR-0005) y su `vitest.config.ts`
para correr los tests del dominio puro dentro de `workerd` real (no una emulación en
Node), siguiendo la documentación clásica de Cloudflare que usa
`defineWorkersConfig` importado de `@cloudflare/vitest-pool-workers/config`.

**Error:** `vitest run` fallaba al cargar la config con
`Error: Missing "./config" specifier in "@cloudflare/vitest-pool-workers" package`.

**Causa:** la versión instalada (`0.22.0`, la última disponible, que trae compatibilidad
con Vitest 4 — el paquete incluye un codemod `vitest-v3-to-v4`) cambió su superficie
pública: ya no expone un subpath `/config` con `defineWorkersConfig`. La API nueva
exporta `cloudflarePool(options)` desde el punto de entrada principal (`.`), pensado
para usarse como el valor de `test.pool` dentro de un `vitest/config` `defineConfig`
normal, no como un wrapper que reemplaza a `defineConfig`. Se confirmó revisando el
`.d.mts` real instalado en `node_modules` (la documentación pública, en este momento,
describe la API anterior).

**Solución:** `vitest.config.ts` quedó así:
```ts
import { defineConfig } from 'vitest/config';
import { cloudflarePool } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  test: { pool: cloudflarePool({ wrangler: { configPath: './wrangler.jsonc' }, isolatedStorage: true }) },
});
```
Además, la cobertura con `@vitest/coverage-v8` no funciona dentro de `workerd` (no es V8
puro de Node): hace falta `@vitest/coverage-istanbul` y `coverage: { provider: 'istanbul' }`.

**Cómo evitarlo:** con paquetes de Cloudflare en preview/alpha activo (`miniflare` con
sufijo `-alpha`, versiones `0.2x` que cambian rápido), no asumir que una guía o tutorial
público describe la API instalada — leer el `.d.mts`/`package.json#exports` real bajo
`node_modules` de la versión que `pnpm` resolvió, sobre todo cuando el error menciona un
subpath de import que "debería" existir según la documentación.
