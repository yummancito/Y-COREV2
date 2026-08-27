# Contribuir a Y-CORE V2

Este archivo es un puntero corto — la guía real vive en `docs/`, no aquí (regla del
repo: toda documentación va a `docs/`, la raíz solo tiene los cinco archivos
estándar).

## Antes de escribir código

1. Lee [`docs/07-contributing/how-to-add-a-feature.md`](docs/07-contributing/how-to-add-a-feature.md)
   — el documento más importante del repo.
2. Si tu cambio toca IPC, lee
   [`docs/07-contributing/how-to-add-an-ipc-channel.md`](docs/07-contributing/how-to-add-an-ipc-channel.md).
3. Si tu cambio es una decisión de arquitectura (dependencia nueva, frontera nueva,
   elegir entre enfoques no obvios), escribe un ADR en `docs/adr/` **antes** de
   escribir el código — plantilla en
   [`docs/adr/0000-template.md`](docs/adr/0000-template.md).

## Estándares

- [`docs/07-contributing/coding-standards.md`](docs/07-contributing/coding-standards.md)
  — límites de tamaño, tipos, errores, boundaries.
- [`docs/07-contributing/testing-guide.md`](docs/07-contributing/testing-guide.md) —
  qué testear y cuánta cobertura exige cada tipo de paquete.
- [`docs/07-contributing/documentation-rules.md`](docs/07-contributing/documentation-rules.md)
  — qué documentar y dónde, obligatorio en el mismo commit que el código.

## Definición de HECHO

```
pnpm lint && pnpm typecheck && pnpm test && pnpm knip && pnpm check:docs && pnpm check:contract
```

Todo verde, o la tarea no está terminada. `services/update-worker` añade además
`pnpm check:worker-routes` y `pnpm check:no-private-key`.

## Commits y versiones

Conventional Commits + `commitlint` (scope de una lista cerrada en
`commitlint.config.mjs`), y un `.changeset/*.md` por cada cambio de cara al usuario
(`pnpm changeset`).
