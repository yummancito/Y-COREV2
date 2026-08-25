---
"@ycore/desktop": minor
---

Añade el watcher de biblioteca de Steam (cierre de Fase 3): vigila las carpetas
`steamapps` en segundo plano con `chokidar` y re-importa la biblioteca (con debounce de
2 s) cuando Steam instala, actualiza o desinstala un juego mientras Y-CORE está abierto —
sin que el usuario tenga que pulsar "importar" de nuevo. En Windows, vigilar un patrón
glob de archivo no dispara eventos de forma fiable y puede crashear el proceso sobre una
ruta con nombre corto 8.3; el watcher vigila el directorio completo y filtra por nombre
en el callback.
