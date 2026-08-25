# Cómo añadir un canal IPC

La frontera main↔renderer es la parte más delicada del repo (ADR-0002). Solo hay un
camino para cruzarla, y es este.

## 1. Declara el canal en el contrato

En `packages/ipc-contract/src/channels/<feature>.ts` (crea el archivo si la feature es
nueva), con `defineChannel`:

```ts
import { z } from 'zod';
import { defineChannel } from '../channel.js';

const launch = defineChannel(
  z.object({ appId: z.number().int().positive().describe('AppID de Steam') })
    .describe('Lanza un juego instalado'),
  z.object({ pid: z.number().int().describe('PID del proceso lanzado') })
    .describe('Proceso resultante'),
);

export const libraryChannels = {
  'library.launch': launch,
};
```

Suma el namespace en `packages/ipc-contract/src/index.ts`:

```ts
export const contract = {
  ...appChannels,
  ...libraryChannels,
} as const;
```

**`.describe()` en todo, siempre input y output.** `assertContractIsFullyDescribed` lo
verifica en runtime al importar el módulo — si falta, el proceso ni arranca. De ahí sale
`docs/01-architecture/ipc-contract.md` (generado con `pnpm --filter @ycore/desktop docs:ipc`,
nunca a mano).

Nombra el canal `<feature>.<verbo>`. Nunca un canal que cruce features.

## 2. Escribe el handler

En `apps/desktop/src/main/features/<feature>/handlers.ts` (o directamente en
`main/ipc/registry.ts` mientras la feature no exista como carpeta propia):

- Recibe el input **ya validado** por el router (`main/ipc/router.ts`). No revalides.
- Devuelve `Result<T, AppError>`. **Nunca lances** — una excepción no controlada la
  captura el router y la convierte en `AppError` con código `ipc.handler-crashed`, pero
  eso es la red de seguridad, no el camino esperado.
- Si algo puede fallar de forma esperable (no existe el juego, Steam cerrado), es un
  `AppError` con su código y contexto, no una excepción.

```ts
async function handleLibraryLaunch(
  input: ChannelInput<typeof contract['library.launch']>,
): Promise<Result<ChannelOutput<typeof contract['library.launch']>, AppError>> {
  if (!isInstalled(input.appId)) return err(appError('not-found', { context: input }));
  return ok({ pid: spawnGame(input.appId) });
}
```

## 3. Regístralo

En `apps/desktop/src/main/ipc/registry.ts`, mapeando el nombre del canal a su handler.
**No crees un `ipcMain.handle`.** Solo existe el del router; tanto el hook
`check-file-rules.mjs` (regla R3) como la regla ESLint `no-restricted-syntax` de
`@ycore/eslint-config` bloquean cualquier otro intento.

`Registry` (definido en `registry.ts`) exige en tipos que **todo** `ChannelName` del
contrato tenga su handler — olvidar uno es un error de compilación, no un bug que
aparece en producción.

## 4. Consúmelo desde el renderer

El preload genera automáticamente `window.ycore.<namespace>.<verbo>` para cada canal del
contrato (ver `apps/desktop/src/preload/build-bridge.ts`) — no hay nada que registrar a
mano ahí. Consume el bridge con TanStack Query, nunca con `ipcRenderer` directo:

```ts
export function useLaunchGame() {
  return useMutation({
    mutationFn: (appId: number) => window.ycore.library.launch({ appId }),
  });
}
```

El resultado **no se guarda en zustand**. zustand es solo para estado de UI.

## 5. Tests

- Handler: caso feliz + al menos un `AppError` (ver `apps/desktop/src/main/ipc/registry.test.ts`
  y `router.test.ts` como referencia — cubren input inválido, output inválido, excepción
  no controlada y canal desconocido).
- `pnpm --filter @ycore/desktop check:contract` — correspondencia bidireccional
  contrato↔registry.

## 6. Verifica

```
pnpm typecheck && pnpm test && pnpm check:contract && pnpm check:docs
```

Y regenera la doc de canales:

```
pnpm --filter @ycore/desktop docs:ipc
```

Si el canal es de una feature nueva, sigue además `how-to-add-a-feature.md`.
