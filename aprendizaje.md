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
