---
"@ycore/desktop": minor
"@ycore/ipc-contract": minor
---

Añade `main/features/steam` (Fase 3): detecta la instalación real de Steam en esta
máquina vía el registro de Windows (`main/platform/steam-registry.ts`, `reg.exe query`
en vez de un binding nativo), escanea todas sus bibliotecas y parsea cada
`appmanifest_*.acf` encontrado con `@ycore/steam-kit`. Un ACF corrupto o una carpeta de
biblioteca ilegible se saltan con un aviso, sin tumbar el escaneo completo. Nuevo canal
`steam.importLibrary`, que guarda lo encontrado reutilizando `LibraryRepository`
(nuevo `upsertMany`) de `main/features/library`.
