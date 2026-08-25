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
