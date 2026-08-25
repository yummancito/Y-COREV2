# Biblioteca — decisiones locales

Decisiones de esta feature que no ameritan un ADR global (no cambian una frontera del
monorepo ni introducen una dependencia nueva).

## `library.list` no acepta filtros todavía

`library.list` devuelve la biblioteca completa sin paginar ni filtrar. Con pocos cientos
de juegos esto es correcto; si el catálogo crece (Fase 3, sincronización real con Steam),
se añadirá un input opcional (`{ query?, installedOnly? }`) sin romper compatibilidad —
Zod hace los campos nuevos opcionales por defecto.

## `LaunchCommand.executablePath` puede ser `null`

`Installation.executablePath` es `null` hasta que `packages/steam-kit` (Fase 3) resuelva
qué ejecutar dentro de la carpeta de instalación, leyendo `appmanifest_*.acf`. Hasta
entonces, `library.launch` de un juego "instalado" sin executable resuelto devuelve
`AppError` `unknown` — no es un placeholder ni un TODO: es el estado real del sistema
hasta que exista `steam-kit`.

## El proceso lanzado no se supervisa

`spawnDetached` (`main/platform/process-launcher.ts`) lanza el juego y `unref()` el
proceso de inmediato: Y-CORE no rastrea si el juego sigue corriendo, no captura su
stdout/stderr, no sabe cuándo termina. Es la decisión correcta para Fase 2 — supervisión
de proceso (para "tiempo jugado", por ejemplo) es una feature aparte, no algo que
`library.launch` deba hacer implícitamente.
