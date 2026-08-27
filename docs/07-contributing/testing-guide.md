# Guía de tests

Qué testear, con qué herramienta, y cuánta cobertura exige cada tipo de paquete.

## Herramienta: Vitest, siempre real cuando se puede

**Vitest** es el único runner del monorepo hoy. El criterio de todo el repo, repetido
en cada ADR (0004, 0005): **preferir un servidor/DB/runtime real a un mock**, cuando el
coste de tenerlo es bajo:

- `services/update-worker` testea contra `workerd` real vía
  `@cloudflare/vitest-pool-workers` — KV/D1/R2 reales de Miniflare, no dobles.
- `main/features/downloads` y `main/features/updates` testean HTTP contra un servidor
  `node:http` real levantado en el propio test, no `fetch` mockeado.
- `packages/updater-client` y `apps/desktop/src/main/features/updates` verifican la
  firma Ed25519 con un par de claves generado con Web Crypto en el propio test, no una
  firma fija hardcodeada.
- `apps/desktop/src/main/db` abre SQLite de verdad (`:memory:` o un archivo temporal),
  nunca un mock del driver.

Un mock se justifica solo cuando el coste real es alto y no aporta nada al test (p. ej.
`electron.app`/`BrowserWindow` en tests de lógica pura que no verifican comportamiento
de Electron en sí).

**Playwright (e2e Electron)** está en el stack elegido del roadmap (sección A.1) pero
**todavía no está instalado ni configurado** — no hay ningún test e2e real hoy. Cuando
se necesite (verificación manual de instalación/actualización real, flujos de UI
completos), se añade siguiendo ese mismo criterio: contra la app real empaquetada, no
contra un DOM simulado.

## Cobertura mínima por tipo de paquete

| Qué | Cobertura mínima |
|---|---|
| `packages/core-domain` | 90% |
| `packages/steam-kit`, `packages/updater-client` | 85% |
| Handlers de features (`main/features/*/handlers.ts`) | 70% |
| Renderer (componentes y hooks) | 50% |
| `services/update-worker/src/domain/` | 90% (regla propia del ADR-0005, más estricta que el resto del servicio) |

Todo bug arreglado lleva su test de regresión — sin excepción, incluso si el fix es de
una línea.

## Qué cubrir en cada capa

- **Dominio puro** (`core-domain`, `steam-kit`, `services/update-worker/src/domain/`):
  caso feliz, cada rama de error, y los bordes explícitos que importan (p. ej.
  `rollout: 0` no incluye a nadie, `rollout: 100` incluye a todos — ver ADR-0005).
- **Repositorios**: caso feliz + al menos un conflicto de constraint de la DB (índice
  único, fila inexistente).
- **Handlers IPC**: caso feliz + al menos un `AppError` — ver
  `apps/desktop/src/main/ipc/registry.test.ts` y `router.test.ts` como referencia
  (cubren input inválido, output inválido, excepción no controlada, canal desconocido).
- **Hooks del renderer**: caso feliz + el bridge devolviendo un `AppError` (el hook
  debe quedar en estado de error, no lanzar).
- **Componentes**: cada fase/estado visible que el componente puede mostrar — no solo
  el camino feliz. Ver `UpdateBanner.test.tsx` como ejemplo: un test por cada fase de
  `UpdateStatus` (`up-to-date`, `available`, `downloading`, `ready-to-install`,
  `failed`, `blocked`).

## Verificación de contrato, no solo de comportamiento

`pnpm check:contract` (desde `apps/desktop`) verifica la correspondencia bidireccional
entre `packages/ipc-contract` y `main/ipc/registry.ts`: todo canal tiene handler, todo
handler está en el contrato. TypeScript ya lo fuerza en compilación (`Registry` exige
el 100% de las claves de `ChannelName`), pero el checker existe para que
`pnpm check:contract` falle con un mensaje claro si ese tipado se relajara alguna vez.

## Definición de HECHO

```
pnpm lint && pnpm typecheck && pnpm test && pnpm knip && pnpm check:docs && pnpm check:contract
```

Todo verde, o la tarea no está terminada. Ver
[`documentation-rules.md`](documentation-rules.md) para la parte de documentación de
esa misma definición.
