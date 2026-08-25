# Y-CORE V2 — Reglas del proyecto

Habla siempre en **español informal**. Proyecto **closed-source**, **sin presupuesto**,
**Windows-only**. Prioridad #1: **cero deuda técnica**.

Este archivo manda sobre cualquier costumbre por defecto. Si algo aquí choca con lo que
harías normalmente, gana lo de aquí.

---

## Antes de escribir código

1. Lee `docs/07-contributing/how-to-add-a-feature.md`.
2. Si la tarea implica una **decisión de arquitectura** → escribe primero un ADR en `docs/adr/`
   con la plantilla `0000-template.md`. **No escribas código hasta tener el ADR.**
3. Si la tarea toca **IPC** → lee `docs/07-contributing/how-to-add-an-ipc-channel.md`.

---

## Reglas INVIOLABLES (rompen el build)

- **UN SOLO `ipcMain.handle`** en todo el repo: `apps/desktop/src/main/ipc/router.ts`.
  Todo canal nuevo se declara en `packages/ipc-contract` con schemas Zod de input y output.
- **El preload NUNCA expone un `invoke()` genérico.** Solo métodos generados desde el contrato.
  (Este fue el agujero de seguridad del v1: el renderer podía llamar a cualquier canal.)
- **Máximo 400 líneas por archivo, 60 por función**, complejidad ciclomática 12.
  Si te acercas, divide. No negocies con este número.
- **Prohibido `any`.** Usa `unknown` + Zod para parsear.
- **Prohibido `throw` cruzando fronteras** (IPC, plugin, servicio). Devuelve `Result<T, AppError>`.
- **Prohibido crear `.md` en la raíz.** Solo existen: README, CONTRIBUTING, LICENSE, SECURITY,
  CHANGELOG. Toda documentación va a `docs/`.
- **Prohibido crear scripts sueltos** en la raíz. Van a `tools/scripts/`, en TypeScript, con
  header de documentación.
- **Prohibido importar entre features.** Feature A jamás importa de Feature B. Si necesitan
  compartir algo, sube esa lógica a `packages/core-domain`.
- **Prohibido meter datos del main process en zustand.** Eso va en TanStack Query.
  zustand es SOLO para estado de UI (filtros, selección, vista abierta).
- **Prohibido `eslint-disable`** sin un comentario `// JUSTIFICACIÓN: ...` justo encima
  y su entrada correspondiente en `docs/exceptions.md`.
- **Prohibido commitear archivos > 5 MB.** (En el v1 había un `.exe` de 428 MB en git.)

---

## Regla de documentación (obligatoria, sin excepciones)

Toda función, módulo o canal público nuevo debe llevar:

1. **TSDoc** encima, con estas cuatro partes siempre presentes:
   - **Qué hace**, en una frase.
   - **Para qué sirve**: qué problema resuelve o en qué caso se usa. No repitas el nombre de
     la función — `// Establece la misión` en `setMission` no documenta nada, falta el "para qué".
   - **`@param` / `@returns`**: qué recibe y qué devuelve.
   - **Qué pasa si falla**: como está prohibido `throw` cruzando fronteras, indica qué variante
     de `AppError` puede salir en el `Result` y cuándo.
   - `@example` si no es trivial.
2. Se documenta **en el mismo commit** que introduce la función. No "luego", no en una tarea
   aparte: una función sin documentar no está terminada.
3. Si es una **feature nueva** → crear `docs/02-features/<feature>/README.md` completo.
4. Si es un **canal IPC nuevo** → usa `.describe()` de Zod **siempre**; la doc de canales se
   genera desde ahí, no se escribe a mano.
5. Si añades una **carpeta** → actualiza `docs/00-overview/repo-map.md`.
6. Añade un **changeset** (`pnpm changeset`) describiendo el cambio de cara al usuario.

**Formato TSDoc:**

```ts
/**
 * Resuelve la ruta de instalación de un juego a partir de su appId.
 *
 * Sirve para que la feature de biblioteca sepa dónde lanzar el ejecutable
 * sin volver a leer libraryfolders.vdf en cada llamada.
 *
 * @param appId - Identificador de Steam de la app.
 * @returns La ruta absoluta si el juego está instalado, o un AppError
 *          `game-not-installed` si no se encuentra en ninguna biblioteca.
 */
```

---

## Cero emojis

Nada de emojis en código, comentarios, TSDoc, commits, nombres de archivo, logs de consola,
mensajes de error ni salida de los checkers de `tools/scripts/`. El público es técnico; los
emojis rompen lectores de pantalla, se renderizan distinto entre plataformas y ensucian los diffs.

En vez de un emoji de estado usa la palabra (`OK`, `FALLO`, `Bloqueado`); en vez de un emoji de
aviso usa un bloque `> Aviso:` o `> Importante:`. Los caracteres de dibujo ASCII en diagramas
no son emojis y sí están permitidos.

---

## Re-verificar que todo queda completo

No se da por cerrada una tarea sin ejecutar (no suponer) esta comprobación mínima:

- Todos los archivos que se dijo que se crearían existen de verdad.
- Todos los enlaces internos de la documentación resuelven a archivos reales.
- El código compila, los tests pasan, los ejemplos de `@example` son correctos.
- No queda ninguna referencia a algo que se borró (ver "Borrado completo" abajo).

Si algo falla, se reporta con la salida real del comando — "debería estar bien" no es una
verificación.

---

## Borrado completo, sin código basura

Al borrar algo se borra entero: llamadas, imports huérfanos, tests que lo probaban, docs que lo
describen, entradas de configuración, enlaces que apuntaban a ello, tipos/constantes que solo
existían para eso. Prohibido código comentado "por si acaso" (está en git), funciones muertas,
imports sin usar, `TODO` sobre algo ya eliminado.

Verificación obligatoria tras cualquier borrado — buscar el nombre eliminado en todo el repo:

```
grep -rn "NombreDeLoBorrado" . --exclude-dir=.git --exclude-dir=node_modules
```

Si aparece algo, el borrado no ha terminado.

---

## Cada error resuelto se anota en aprendizaje.md

En cuanto se detecta un error y se resuelve, se registra en `aprendizaje.md` (raíz del repo).
Aplica a errores de código, fallos de diseño, supuestos equivocados, decisiones revertidas,
herramientas que no funcionaron como se esperaba.

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
comprobación automática (checker, test, regla de ESLint) — se revisa la entrada, no solo el error.

---

## Definición de HECHO

Una tarea no está terminada hasta que pasan **todos**:

```
pnpm lint && pnpm typecheck && pnpm test && pnpm knip && pnpm check:docs && pnpm check:contract
```

Y además, de la checklist de yumman agency:

- [ ] Cada función nueva indica para qué sirve, qué recibe, qué devuelve y qué pasa si falla.
- [ ] Sin emojis en texto, código, documentación ni commits.
- [ ] Verificado que todo quedó completo, ejecutando las comprobaciones (no supuesto).
- [ ] Enlaces internos de la documentación verificados.
- [ ] Errores resueltos anotados en `aprendizaje.md`.
- [ ] Lo borrado está borrado del todo, comprobado con `grep`.
- [ ] Sin código muerto, sin imports huérfanos, sin código comentado.

---

## Cosas que NO se hacen en este repo

- **No reintroducir `electron-updater`.** Tenemos `packages/updater-client` propio (ADR-0003).
- **No crear un "V2" de un store existente.** Se refactoriza el original o se borra.
  (El v1 acabó con `useLibraryStore` + `useLibraryV2Store` y dos motores de descargas.)
- **No dejar código comentado "por si acaso".** Está en git.
- **No escribir informes de auditoría en `.md`.** Abre un issue.
  (El v1 tenía ~90 `.md` contradictorios en la raíz.)
- **No meter secretos ni API keys en el cliente.** Todo pasa por el Worker.

---

## Contexto del producto

Y-CORE es un gestor de juegos de Steam para Windows. Se reconstruye desde cero tras
v4.3.12, que acumuló 167 `ipcMain.handle` dispersos, stores duplicados y archivos de
2000 líneas. El roadmap completo por fases está en `docs/00-overview/roadmap.md`.

El repo viejo (`../Y-CORE`) se consulta como **referencia** para portar algoritmos
(parsers ACF/VDF, detección de DRM) — **nunca se copia y pega código de ahí**.

El estándar de disciplina de trabajo (documentación, cero emojis, `aprendizaje.md`, borrado
completo) viene de `../../yumman agency/CLAUDE.md`. Las reglas de arquitectura de este archivo
(IPC, límites de tamaño, boundaries) son propias de Y-CORE V2 y no están en yumman agency.
