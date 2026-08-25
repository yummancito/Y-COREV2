# Feature: Biblioteca

Molde canónico de todas las features de Y-CORE (Fase 2 del roadmap). Lista los juegos
conocidos y lanza uno instalado.

## Qué hace

- Muestra todos los juegos conocidos por Y-CORE, instalados o no.
- Lanza un juego instalado como proceso independiente (detached).

## Quién la usa

El renderer, vía `window.ycore.library.list()` y `window.ycore.library.launch({ appId })`.
No la usa ninguna otra feature del main directamente — si otra feature necesitara datos
de biblioteca, esa lógica compartida sube a `packages/core-domain`, nunca se importa
`main/features/library` desde otra feature (regla de boundaries, sección B.3 del roadmap).

## Cómo encaja

```
apps/desktop/src/main/features/library/
  index.ts        API pública: LibraryRepository, LibraryService, createLibraryHandlers
  repository.ts    traduce entre la tabla `games` (Drizzle) y Game/Installation (core-domain)
  service.ts       orquesta repository + core-domain (resolveLaunchCommand) + platform (spawn)
  handlers.ts      traduce entre el tipo de dominio y la forma exacta del contrato IPC

apps/desktop/src/renderer/features/library/
  index.ts               API pública: LibraryGrid
  hooks/use-library-query.ts   TanStack Query sobre window.ycore.library.list
  hooks/use-launch-game.ts     TanStack Query (mutation) sobre window.ycore.library.launch
  components/GameCard.tsx      una tarjeta: nombre, estado, botón Jugar
  components/LibraryGrid.tsx   pantalla completa: carga, vacío, error, grid
```

- `packages/core-domain` — `Game`, `Installation`, `resolveLaunchCommand` (puro, sin Electron).
- `apps/desktop/src/main/db` — tabla `games`, migrada con Drizzle.
- `apps/desktop/src/main/platform/process-launcher.ts` — único lugar que hace `spawn` real.
- `packages/ipc-contract` — canales `library.list` y `library.launch`, ver
  [ipc-channels.md](ipc-channels.md).

Ver [data-model.md](data-model.md) para las entidades, [decisions.md](decisions.md) para
decisiones locales que no ameritaron un ADR, [ui-flows.md](ui-flows.md) para los
recorridos de usuario.

## Estado

Fase 2: repositorio, servicio, handlers de main y la pantalla del renderer completos y
testeados (repositorio/servicio contra SQLite real, componentes/hooks con React Testing
Library). Sin datos reales de Steam todavía (Fase 3) — la biblioteca se puebla a mano en
la DB hasta entonces. Sin virtualización del grid (ver
[decisions.md](decisions.md#librarygrid-no-está-virtualizado-todavía)).
