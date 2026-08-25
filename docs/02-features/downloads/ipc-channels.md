# Descargas — canales IPC

Generado desde `packages/ipc-contract` — ver
[`docs/01-architecture/ipc-contract.md`](../../01-architecture/ipc-contract.md), sección
`Namespace downloads.*`. No se edita a mano aquí: para cambiar la doc de un canal, edita
su `.describe()` en `packages/ipc-contract/src/channels/downloads.ts` y corre
`pnpm --filter @ycore/desktop docs:ipc`.

Canales de esta feature: `downloads.enqueue`, `downloads.list`, `downloads.pause`,
`downloads.cancel`.

No hay canal de eventos push (`downloads.onProgress` o similar): el renderer hace
polling de `downloads.list` con TanStack Query (`refetchInterval`) mientras haya una
descarga activa. Ver [decisions.md](decisions.md) para por qué.
