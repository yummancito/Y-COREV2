---
"@ycore/desktop": patch
---

La biblioteca ya no queda vacía para siempre en el primer arranque: además de
reaccionar a instalaciones/desinstalaciones futuras, `startSteamWatcher` ahora
importa la biblioteca de Steam existente una vez al arrancar la app.

De paso, los scripts `rebuild-native-for-electron.mjs`/`rebuild-native-for-node.mjs`
verifican de verdad (cargando el binario en un proceso Node real) que el binding
que guardan o restauran es el correcto, en vez de asumirlo por la existencia de un
archivo — evita que una secuencia de comandos fuera del orden esperado deje
`better-sqlite3` sin binding válido para los tests.
