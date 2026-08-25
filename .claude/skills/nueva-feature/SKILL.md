---
name: nueva-feature
description: Workflow completo para añadir una feature vertical a Y-CORE V2 — ADR, scaffolding main+renderer, canales IPC, tests, documentación y changeset. Úsalo siempre que vayas a crear una feature nueva, antes de escribir el primer archivo.
---

# Añadir una feature a Y-CORE V2

Una feature es **vertical**: existe en `main` y en `renderer` con el mismo nombre, y
se comunican solo por canales `<feature>.*` del contrato. Nunca importa de otra feature.

Sigue estos pasos **en orden**. No te saltes ninguno.

## 1. ¿Hace falta un ADR?

Si la feature introduce una dependencia nueva, cambia una frontera, o elige entre dos
enfoques no obvios → lanza el agente `arquitecto` y espera el ADR **antes** de codear.
Si es una feature rutinaria que sigue el molde existente, sigue al paso 2.

## 2. Declara los canales primero

Antes del código de la feature, define en `packages/ipc-contract` los canales que va a
necesitar. Cada uno con input y output en Zod, **ambos con `.describe()`**.

Piensa la API antes que la implementación: si el contrato queda feo, la feature está
mal planteada.

## 3. Scaffolding

```
apps/desktop/src/main/features/<x>/
  index.ts        # API pública explícita (NO un barrel que reexporta todo)
  handlers.ts     # funciones que registra el router; devuelven Result<T, AppError>
  service.ts      # lógica de la feature
  repository.ts   # acceso a DB vía Drizzle (si aplica)

apps/desktop/src/renderer/features/<x>/
  index.ts        # API pública explícita
  components/     # componentes de la feature
  hooks/          # useXQuery, useXMutation → TanStack Query sobre el cliente tipado
  store.ts        # zustand SOLO para estado de UI (filtros, selección). Nunca datos del main.
```

Lógica pura y reutilizable → `packages/core-domain`, no dentro de la feature.

## 4. Registra los handlers

En `apps/desktop/src/main/ipc/registry.ts`. **No** crees un `ipcMain.handle` nuevo:
solo existe el del router.

## 5. Tests

- Lógica pura en `core-domain` → cobertura ≥90%.
- Handlers de la feature → ≥70%.
- Test de contrato: el canal nuevo tiene handler y viceversa (`pnpm check:contract`).

## 6. Documentación (obligatoria)

Crea `docs/02-features/<x>/`:
- `README.md` — qué hace, quién la usa, cómo encaja. Mínimo 200 caracteres reales.
- `data-model.md` — entidades y tablas.
- `ipc-channels.md` — generado desde los `.describe()`.
- `ui-flows.md` — si tiene UI.
- `decisions.md` — decisiones locales.

Actualiza `docs/00-overview/repo-map.md` si añadiste carpetas.

## 7. Changeset

`pnpm changeset` describiendo el cambio **de cara al usuario**, no técnicamente.

## 8. Definición de HECHO

```
pnpm lint && pnpm typecheck && pnpm test && pnpm knip && pnpm check:docs && pnpm check:contract
```

Todo verde, o la feature no está terminada.
