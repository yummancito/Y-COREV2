---
"@ycore/desktop": minor
---

Lado renderer de la feature Biblioteca (Fase 2 completa): `LibraryGrid` y `GameCard`,
con `useLibraryQuery`/`useLaunchGame` sobre TanStack Query. `App.tsx` monta la pantalla
real en vez del test de arranque de `app.ping`.

Corrige tres bugs de arranque real de la app (Electron): interop CJS/ESM con
better-sqlite3 (`apps/desktop/package.json` ya no declara `"type": "module"`),
`externalizeDepsPlugin()` dejaba sin transpilar los paquetes del workspace, y el
prebuild de better-sqlite3 no coincide con la ABI de Electron — nuevos scripts
`pnpm rebuild:native:electron` / `pnpm rebuild:native:node` para alternar el binding
nativo según el contexto de ejecución.
