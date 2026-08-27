---
"@ycore/desktop": patch
---

Corrige dos bugs reales que impedían que la app arrancara de verdad en Windows:

1. `better-sqlite3` bajado de `^13.0.3` a `^11.10.0` — la versión 13.x (primera migrada
   de NAN a N-API) segfaultea el proceso de Electron al abrir la base de datos, sin
   ninguna excepción de JS capturable ni rastro en los logs de Windows. La app se
   quedaba colgada indefinidamente sin abrir ventana.
2. La ruta de migraciones en `main/bootstrap/database.ts` apuntaba un nivel por
   encima de donde el bundle real las copia (`out/db/migrations` en vez de
   `out/main/db/migrations`), rompiendo el arranque incluso con la DB ya funcionando.
3. El preload (que corre con `sandbox: true`) no podía cargar `zod` porque quedaba
   como dependencia externa sin bundlear — `window.ycore` nunca se exponía al
   renderer y toda la UI mostraba "Cannot read properties of undefined".

Los scripts `rebuild-native-for-electron.mjs`/`rebuild-native-for-node.mjs` ya no
tienen la versión de `better-sqlite3` hardcodeada en la ruta — se resuelve
dinámicamente, para no romperse en el próximo cambio de versión.
