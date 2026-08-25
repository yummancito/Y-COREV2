---
"@ycore/desktop": minor
---

Añade la tabla `downloads` (Drizzle, con el índice único parcial que impide dos
descargas activas del mismo juego) y `DownloadRepository`, la capa de persistencia del
motor de descargas (Fase 4, ADR-0004). Todavía sin cliente HTTP, servicio, canal IPC ni
UI — esta pieza solo guarda y lee el estado de una descarga contra SQLite real.
