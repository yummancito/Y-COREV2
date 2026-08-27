# Actualizaciones — canales IPC

Generado desde `packages/ipc-contract` — ver
[`docs/01-architecture/ipc-contract.md`](../../01-architecture/ipc-contract.md), sección
`Namespace updates.*`. No se edita a mano aquí: para cambiar la doc de un canal, edita
su `.describe()` en `packages/ipc-contract/src/channels/updates.ts` y corre
`pnpm --filter @ycore/desktop docs:ipc`.

Canales de esta feature: `updates.getStatus`, `updates.installNow`.

No hay canal de eventos push: el renderer hace polling de `updates.getStatus` con
TanStack Query (`refetchInterval`), igual que `downloads.list`. Ver
[decisions.md](decisions.md) de la feature Descargas para por qué este repo no tiene
todavía un patrón main→renderer push.
