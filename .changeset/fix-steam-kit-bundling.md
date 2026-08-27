---
"@ycore/desktop": patch
---

Corrige un bug real que impedía arrancar la app empaquetada: `@ycore/steam-kit`
faltaba en la lista de paquetes del workspace que `electron.vite.config.ts` excluye
de la externalización, así que el bundle del main process intentaba `require()`
código TypeScript sin transpilar y crasheaba al cargar (`SyntaxError: Unexpected
token 'export'`). Descubierto al lanzar la app en modo desarrollo por primera vez.
