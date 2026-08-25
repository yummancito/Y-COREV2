# Feature: Steam

Fase 3 del roadmap. Detecta la instalación real de Steam en esta máquina, escanea su
biblioteca en disco y la sincroniza con la tabla `games` que ya usa la feature Biblioteca.

## Qué hace

- Encuentra dónde está instalado Steam vía el registro de Windows.
- Escanea todas las carpetas de biblioteca (la principal más las declaradas en
  `libraryfolders.vdf`) y parsea cada `appmanifest_*.acf` encontrado.
- Guarda lo encontrado en la tabla `games` (inserta juegos nuevos, actualiza los que ya
  existían) — reutiliza `LibraryRepository` de `main/features/library`, no duplica
  persistencia.

## Quién la usa

El renderer, vía `window.ycore.steam.importLibrary()` — un botón "Importar biblioteca de
Steam" dispara el escaneo completo y, al terminar, `library.list` ya refleja lo
encontrado. No hay UI propia de esta feature todavía: el resultado (`gamesFound`) es
solo el número de juegos importados, la lista real se lee siempre por `library.list`.

## Cómo encaja

```
apps/desktop/src/main/platform/steam-registry.ts
  findSteamInstallPath   único lugar que lee el registro de Windows para Steam

apps/desktop/src/main/features/steam/
  index.ts               API pública: SteamService, createSteamHandlers
  library-scanner.ts      lee disco (steamapps/, appmanifest_*.acf) y arma Game[]
  service.ts               orquesta library-scanner + LibraryRepository
  handlers.ts               traduce entre el dominio y la forma exacta del contrato IPC
```

- `packages/steam-kit` — parsers puros (VDF, `libraryfolders.vdf`, `appmanifest_*.acf`,
  `loginusers.vdf`, `depotcache`), sin tocar disco ni Electron.
- `apps/desktop/src/main/features/library` — dueño de la tabla `games` y de
  `LibraryRepository.upsertMany`, que esta feature reutiliza en vez de escribir su propio
  acceso a la DB (regla de boundaries: no se duplica persistencia entre features).
- `packages/ipc-contract` — canal `steam.importLibrary`, ver
  [ipc-channels.md](ipc-channels.md).

Ver [data-model.md](data-model.md) para cómo se traduce un `appmanifest_*.acf` a `Game`,
[decisions.md](decisions.md) para decisiones locales que no ameritaron un ADR.

## Estado

Fase 3 parcial: detección de Steam por registro, escaneo de biblioteca completo (multi-
biblioteca, tolerante a ACFs corruptos) y sincronización con la DB, todo testeado. Falta
el watcher con chokidar (sincronización automática cuando cambian los archivos ACF, sin
que el usuario tenga que pulsar "importar" de nuevo) — sigue pendiente en el roadmap.
`executablePath` de cada `Installation` importada queda en `null`: resolver qué binario
ejecutar dentro de la carpeta de instalación es trabajo de `resolveLaunchCommand`
(`packages/core-domain`), no de esta feature.
