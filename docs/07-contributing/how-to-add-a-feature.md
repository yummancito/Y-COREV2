# Cómo añadir una feature

El documento más importante del repo. Si sigues esto, la app no acumula deuda.
Si te lo saltas, en seis meses tenemos otro `LibraryPage.tsx` de 1985 líneas.

## Qué es una feature aquí

Una **vertical**: existe con el mismo nombre en `main` y en `renderer`, y se comunican
**solo** por canales `<feature>.*` del contrato IPC.

```
apps/desktop/src/main/features/library/       ←→  canales library.*  ←→  apps/desktop/src/renderer/features/library/
```

La propiedad que compramos con esto: **borrar una feature es borrar dos carpetas y una
sección del contrato**. Nada más queda colgando. Eso es lo que hace la app fácil de mantener.

**Una feature nunca importa de otra feature.** Si dos necesitan lo mismo, esa lógica sube
a `packages/core-domain`.

---

## Los pasos, en orden

### 1. ¿Necesitas un ADR?

Sí, si la feature introduce una dependencia nueva, cambia una frontera, o elige entre
enfoques no obvios. Escríbelo **antes** del código (skill `nuevo-adr` o agente `arquitecto`).

No, si sigue el molde de una feature existente.

### 2. Diseña el contrato antes que la implementación

Declara en `packages/ipc-contract` los canales que la feature necesita, con Zod y
`.describe()` en input y output. Ver `how-to-add-an-ipc-channel.md`.

Si el contrato queda feo, la feature está mal planteada. Es más barato descubrirlo aquí.

### 3. Estructura

```
apps/desktop/src/main/features/<x>/
  index.ts        API pública explícita — NO un barrel que reexporta todo
  handlers.ts     lo que registra el router; devuelve Result<T, AppError>
  service.ts      lógica de la feature
  repository.ts   acceso a DB con Drizzle (si aplica)

apps/desktop/src/renderer/features/<x>/
  index.ts        API pública explícita
  components/     componentes de la feature
  hooks/          useXQuery / useXMutation → TanStack Query sobre el cliente tipado
  store.ts        zustand SOLO para estado de UI
```

Sobre `index.ts`: lista lo que expones, explícitamente. El v1 tenía un barrel que exportaba
14 de 31 servicios y nadie sabía cuáles eran públicos.

### 4. Dónde va cada cosa

| Tipo de código | Dónde | Por qué |
|---|---|---|
| Reglas de negocio puras | `packages/core-domain` | Testeable sin Electron, reutilizable entre features |
| Parsing de formatos Steam | `packages/steam-kit` | Puro: entra contenido, sale objeto. No toca el disco |
| Acceso a disco, registro, procesos | `main/platform` | Único sitio que habla con el SO |
| Estado del servidor (datos del main) | TanStack Query | **Nunca zustand** |
| Estado de UI (filtros, selección, modal abierto) | zustand en `store.ts` | |

**La regla de oro del estado**: si el dato viene del main process, va en TanStack Query.
Meter datos del backend en zustand fue lo que produjo `useLibraryStore` + `useLibraryV2Store`
en el v1: dos fuentes de verdad que se desincronizaban.

### 5. Registra los handlers

En `apps/desktop/src/main/ipc/registry.ts`. **No escribas un `ipcMain.handle`**: solo existe
el del router, y el hook te bloqueará si lo intentas.

### 6. Tests

| Qué | Cobertura mínima |
|---|---|
| `core-domain` | 90% |
| `steam-kit`, `updater-client` | 85% |
| Handlers de features (main) | 70% |
| Renderer | 50% |

Todo bug arreglado lleva su test de regresión.

### 7. Documenta (obligatorio)

Crea `docs/02-features/<x>/`:

- `README.md` — qué hace, quién la usa, cómo encaja. Mínimo 200 caracteres reales, sin TODOs.
- `data-model.md` — entidades y tablas.
- `ipc-channels.md` — generado desde los `.describe()`; no lo escribas a mano.
- `ui-flows.md` — si tiene UI.
- `decisions.md` — decisiones locales que no merecen ADR global.

Actualiza `docs/00-overview/repo-map.md` si añadiste carpetas.

`pnpm check:docs` falla si esto no está, y el hook `Stop` no te deja cerrar la tarea.

### 8. Changeset

`pnpm changeset`, describiendo el cambio **de cara al usuario**, no técnicamente.

---

## Definición de HECHO

```
pnpm lint && pnpm typecheck && pnpm test && pnpm knip && pnpm check:docs && pnpm check:contract
```

Todo verde, o la feature no está terminada.

---

## Los límites que te van a frenar (y por qué)

- **400 líneas por archivo, 60 por función.** No es negociable y no hay excepciones por
  "este caso es especial". Si te acercas, es señal de que hay más de una responsabilidad ahí.
- **Prohibido `any`.** `unknown` + Zod.
- **Prohibido `throw` cruzando fronteras.** `Result<T, AppError>`.
- **Prohibido importar entre features.**
- **Prohibido crear un "V2" de algo que ya existe.** Se refactoriza el original o se borra.

Todo esto está en `.claude/CLAUDE.md` y lo verifica el hook `check-file-rules.mjs` en el
momento de escribir el archivo, antes de llegar a lint.
