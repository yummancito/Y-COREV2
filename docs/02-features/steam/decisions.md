# Steam — decisiones locales

Decisiones de esta feature que no ameritan un ADR global (no cambian una frontera del
monorepo ni introducen una dependencia nueva).

## Registro de Windows vía `reg.exe`, no un paquete con binding nativo

Se evaluó un paquete npm con binding nativo para leer el registro directamente, pero ya
hubo problemas serios de ABI con `better-sqlite3` en este mismo repo (ver
`aprendizaje.md`: dos binarios distintos según se ejecute bajo Node o Electron). `reg.exe`
viene instalado con Windows, se invoca con `child_process.execFile` (sin `shell: true`,
argumentos como array — sin riesgo de inyección) y no añade ninguna dependencia de
compilación nueva. El costo es parsear texto en vez de un objeto tipado, pero el formato
de salida de `reg query` es estable y el parseo es una única expresión regular.

## Un ACF corrupto no tumba el escaneo completo

`readAppManifestsFrom` (`library-scanner.ts`) captura el error de lectura o de parseo de
cada `appmanifest_*.acf` individualmente, registra un `log.warn` y sigue con el resto.
Steam mismo tolera manifests corruptos (los vuelve a escribir si detecta el daño) — un
solo archivo dañado en una biblioteca de cientos de juegos no debe impedir importar el
resto.

## `libraryfolders.vdf` ausente o corrupto no es un error fatal

Si Steam está instalado pero `libraryfolders.vdf` no se puede leer o parsear,
`resolveSteamAppsDirs` sigue solo con la biblioteca principal en vez de devolver
`AppError`. Es el mismo principio de "graceful degradation" que documentó el v1: nunca
menos de una biblioteca disponible por un archivo secundario dañado.

## `steam.importLibrary` no acepta parámetros

El canal escanea siempre la instalación completa de esta máquina — no hay forma de pedir
"solo esta carpeta" o "solo estos juegos". Con una sola biblioteca a la vez este es el
caso de uso real; si en el futuro hace falta importar selectivamente, se añade un input
opcional a `steam.importLibrary` sin romper compatibilidad (Zod permite campos opcionales
nuevos).

## Sin watcher de archivos (chokidar) todavía

El roadmap original de Fase 3 incluye sincronización automática cuando cambian los ACF en
disco (instalar/desinstalar un juego fuera de Y-CORE). No está implementado: por ahora la
sincronización es manual (`steam.importLibrary` bajo demanda desde el renderer). Añadir un
watcher permanente implica gestionar su ciclo de vida (arrancar con la app, pararlo al
cerrar, debounce de eventos de escritura en ráfaga) — se deja para cuando exista la UI que
lo dispare, en vez de adelantar la infraestructura sin consumidor.
