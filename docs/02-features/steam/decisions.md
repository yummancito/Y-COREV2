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

## El watcher vigila directorios, nunca un patrón glob de archivo

`watcher.ts` vigila la carpeta `steamapps` completa (`depth: 0`) y filtra por nombre
(`appmanifest_\d+\.acf`) dentro del callback, en vez de pasarle a chokidar un patrón como
`steamapps/appmanifest_*.acf`. En Windows, un glob de archivo no dispara eventos de forma
fiable con el watcher nativo de chokidar y, si la ruta de base resuelve a un nombre corto
8.3 (algo común bajo `%TEMP%` en algunas máquinas), directamente crashea el proceso — ver
`aprendizaje.md`. Vigilar el directorio es la forma verificada de que funcione en
cualquier máquina Windows.

## Re-importación completa en cada cambio, no un diff incremental

Cuando el watcher detecta un ACF nuevo/modificado/borrado, dispara
`SteamService.importLibrary()` completo (vuelve a escanear todas las bibliotecas), en vez
de parsear solo el archivo que cambió y hacer un upsert puntual. Con la cantidad de juegos
que tiene una biblioteca real (cientos, no millones) un escaneo completo es barato, y
mantiene una sola ruta de código para "sincronizar la biblioteca" en vez de dos
(importación manual completa vs. actualización incremental por archivo) que podrían
divergir.

## Debounce de 2 segundos, un timer por watcher (no por archivo)

Steam reescribe un ACF varias veces seguidas durante una instalación (progreso, tamaño
final, `lastUpdated`), y una instalación con varios juegos en paralelo toca varios
archivos casi a la vez. Un único temporizador de debounce compartido (no uno por archivo)
agrupa toda esa actividad en una sola re-importación por ráfaga, en vez de disparar N
escaneos completos casi simultáneos.
