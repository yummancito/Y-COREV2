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

## `LibraryGrid` no está virtualizado todavía

El criterio de HECHO de Fase 2 pide que 10.000 juegos falsos rendericen a 60 fps, lo que
normalmente exige un grid virtualizado (`@tanstack/react-virtual`). No hay datos reales
todavía (Steam real llega en Fase 3) para medir el costo real de renderizar, así que
`LibraryGrid` mapea `library.data` directamente sin virtualizar. Cuando exista una
biblioteca real (o un dataset de prueba masivo) para medir de verdad, se virtualiza
entonces — añadir la dependencia hoy sin nada que la justifique sería complejidad
adelantada sin caso de uso.
