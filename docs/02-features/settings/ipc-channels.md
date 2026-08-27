# Ajustes — canales IPC

Generado desde `packages/ipc-contract` — ver
[`docs/01-architecture/ipc-contract.md`](../../01-architecture/ipc-contract.md),
sección `Namespace settings.*`. No se edita a mano aquí: para cambiar la doc de un
canal, edita su `.describe()` en `packages/ipc-contract/src/channels/settings.ts` y
corre `pnpm --filter @ycore/desktop docs:ipc`.

Canales de esta feature: `settings.get`, `settings.update`.

`settings.update` siempre devuelve el objeto `AppSettings` completo, no solo el
parche recibido — ver [data-model.md](data-model.md) para la forma exacta.
