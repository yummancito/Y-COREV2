---
"@ycore/desktop": minor
"@ycore/ipc-contract": minor
---

Primera feature vertical completa del lado main (Fase 2 — molde canónico): Biblioteca.
Lista los juegos conocidos (`library.list`) y lanza uno instalado (`library.launch`) como
proceso independiente. `main/features/library` (repositorio Drizzle, servicio,
handlers) y `main/platform/process-launcher.ts` (único lugar que ejecuta procesos
externos). El registry del router ahora se construye con la conexión real de base de
datos en el arranque, en vez de ser estático.
