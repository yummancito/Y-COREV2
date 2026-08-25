---
name: nuevo-canal-ipc
description: Añade un canal IPC a Y-CORE V2 siguiendo el contrato tipado — schema Zod con .describe(), registro del handler, hook de TanStack Query, test de contrato y regeneración de la doc. Úsalo siempre que necesites comunicar renderer y main.
---

# Añadir un canal IPC

La frontera main↔renderer es la parte más delicada del repo. En el v1 acabó con 167
`ipcMain.handle` dispersos y un `invoke()` genérico sin allowlist. Aquí solo hay un
camino, y es este.

## 1. Declara el canal en el contrato

En `packages/ipc-contract`, dentro del namespace de su feature:

```ts
'library.launch': {
  input:  z.object({ appId: z.number().int().positive().describe('AppID de Steam') })
            .describe('Lanza un juego instalado'),
  output: z.object({ pid: z.number().int().describe('PID del proceso lanzado') })
            .describe('Proceso resultante'),
}
```

**`.describe()` en todo, siempre.** De ahí sale `docs/02-features/<x>/ipc-channels.md`.
Sin descripción, el canal queda indocumentado y CI falla.

Nombra el canal `<feature>.<verbo>`. Nunca un canal que cruce features.

## 2. Escribe el handler

En `apps/desktop/src/main/features/<x>/handlers.ts`:

- Recibe el input **ya validado** por el router. No revalides.
- Devuelve `Result<T, AppError>`. **Nunca lances** — un throw que cruza el IPC es un bug.
- Si algo puede fallar de forma esperable (no existe el juego, Steam cerrado), es un
  `AppError` con su código y clave i18n, no una excepción.

## 3. Regístralo

En `apps/desktop/src/main/ipc/registry.ts`, mapeando el nombre del canal a su handler.
**No crees un `ipcMain.handle`.** Solo existe el del router; el hook `check-file-rules`
te bloqueará si lo intentas.

## 4. Consúmelo desde el renderer

Con TanStack Query sobre el cliente tipado, nunca con `ipcRenderer` directo:

```ts
export function useLaunchGame() {
  return useMutation({ mutationFn: (appId: number) => window.ycore.library.launch({ appId }) });
}
```

El resultado **no se guarda en zustand**. zustand es solo para estado de UI.

## 5. Tests

- `pnpm check:contract` — correspondencia bidireccional contrato↔handlers.
- Un test del handler: caso feliz + al menos un `AppError`.

## 6. Verifica

```
pnpm typecheck && pnpm test && pnpm check:contract && pnpm check:docs
```

Si el canal es de una feature nueva, sigue además la skill `nueva-feature`.
