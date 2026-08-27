# Visión general de la arquitectura

Cómo se comunican los procesos de `apps/desktop`, y cómo se relacionan con los
servicios externos.

## Los tres procesos de Electron

```
┌─────────────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│   Renderer (React)   │  IPC   │   Preload (bridge)    │  IPC   │   Main (Node)       │
│   src/renderer/       │◄──────►│   src/preload/        │◄──────►│   src/main/          │
│   sandbox: true       │        │   contextIsolation    │        │   sin sandbox        │
└─────────────────────┘        └──────────────────────┘        └────────────────────┘
```

- **Renderer**: React 19 + TanStack Query. Nunca toca Node ni Electron directamente
  (`nodeIntegration: false`, `sandbox: true` — ver `main/bootstrap/window.ts`). Todo lo
  que necesita del sistema pasa por `window.ycore`.
- **Preload**: el único código con acceso simultáneo a `contextBridge` y al contrato
  IPC. Construye `window.ycore` a partir de las claves de `packages/ipc-contract` — ver
  [`error-handling.md`](error-handling.md) para el shape exacto de cada llamada.
- **Main**: Node completo (DB, disco, red, procesos del SO). Contiene el router IPC
  único, las features verticales, y el bootstrap de arranque.

## Un solo canal físico, un contrato tipado por encima

Físicamente solo existe **un** `ipcMain.handle` (`ycore:invoke`,
`main/ipc/router.ts`). El renderer nunca invoca ese canal directamente: llama a
`window.ycore.<feature>.<verbo>(input)`, que el preload traduce a
`{ channel: "<feature>.<verbo>", payload: input }` sobre ese único canal físico.

El router valida `channel` contra `packages/ipc-contract`, valida `payload` con el
schema Zod de entrada, ejecuta el handler del `Registry`, y valida la salida antes de
devolverla. Ver [`error-handling.md`](error-handling.md) para qué pasa cuando algo de
esto falla, y [`../07-contributing/how-to-add-an-ipc-channel.md`](../07-contributing/how-to-add-an-ipc-channel.md)
para el procedimiento de añadir un canal nuevo.

## Features verticales

Cada feature de producto (`library`, `steam`, `downloads`, `updates`) existe como dos
carpetas paralelas — `main/features/<x>/` y `renderer/features/<x>/` — que se
comunican **solo** por los canales `<x>.*` de su propia sección del contrato. Nunca
una feature importa código de otra directamente: si dos necesitan lo mismo, esa lógica
sube a `packages/core-domain`. Ver [`boundaries.md`](boundaries.md) para la matriz
completa de quién puede importar a quién, y `docs/02-features/` para la documentación
de cada feature.

## Servicios externos

```
apps/desktop  ──HTTPS──►  services/update-worker (Cloudflare Worker)
                              │
                              ├─► KV    (YCORE_CONFIG: mantenimiento, rollout, bloqueos)
                              ├─► D1    (releases, maintenance_log, admin_actions_log, check_stats)
                              └─► R2    (instaladores, blockmaps, manifests firmados)
```

`packages/updater-client` (usado desde `main/features/updates`) es el único código de
la app que habla con `services/update-worker`, vía HTTP. `tools/cli` es un proceso
totalmente separado (Node, fuera de la app) que un humano usa para administrar
releases, mantenimiento y bloqueos contra el mismo Worker — ver
`docs/03-services/update-worker/README.md`.

No hay ningún otro servicio externo: sin backend de catálogo, sin analítica de
terceros, sin telemetría — ver `docs/06-security/threat-model.md` para qué datos
salen de la máquina del usuario y hacia dónde.
