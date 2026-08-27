# Continuar — estado real de la sesión anterior

> Este documento es el punto de entrada para retomar el trabajo. Se actualiza al
> final de cada sesión de trabajo (cuando el usuario dice "listo por hoy" o
> equivalente) — ver la regla en `.claude/CLAUDE.md`. Reemplaza el contenido
> entero cada vez; no se acumulan entradas históricas aquí (eso es lo que ya hace
> `aprendizaje.md` y el historial de git).

## Última actualización

**2026-08-27**

## En qué fase del roadmap estamos

Contra `docs/00-overview/roadmap.md`:

| Fase | Estado |
|---|---|
| F0 — Bootstrap | Cerrada |
| F1 — Núcleo IPC/DB | Cerrada, verificada con arranque real (antes solo con tests) |
| F2 — Biblioteca | Cerrada funcionalmente — importa juegos reales al arrancar |
| F3 — Integración Steam | Cerrada — watcher + scanner + parsers, verificado en vivo |
| F4 — Motor de descargas | Implementada (core-domain, repo, servicio, canal IPC) pero **no probada en vivo en esta sesión** |
| F5 — Sistema de updates | Cliente completo y testeado; falta desplegar `services/update-worker` real y configurar env vars de producción |
| F6 — Ajustes/saves/Discord/pulido | Ajustes ya cerrado (schema versionado + UI); saves, Discord RPC, onboarding, bandeja, atajos globales: no empezados |
| F7-F11 — Plugins | No empezadas |

**Próximo hito real del roadmap:** cerrar F5 con el Worker desplegado marca la
"primera release pública". Antes de eso, probar F4 (descargas) en vivo es lo más
cercano/barato.

## Qué se hizo en la última sesión (2026-08-27)

Sesión larga centrada en pasar la app de "nunca se ha lanzado de verdad" a
"arranca y muestra datos reales". Bugs reales encontrados y arreglados, todos
comiteados con changeset:

1. **`better-sqlite3@13.0.3` segfaulteaba Electron 33** (primera versión migrada a
   N-API, muy reciente) — bajado a `^11.10.0`. Ver
   [memoria: better-sqlite3-electron-bug] y `aprendizaje.md` (2026-08-27, varias
   entradas). Commit `1ef4ffd`.
2. Ruta de migraciones (`main/bootstrap/database.ts`) apuntaba un nivel de más en
   el bundle compilado — mismo commit `1ef4ffd`.
3. El preload (`sandbox: true`) no podía cargar `zod` sin bundlear — mismo commit.
4. La biblioteca nunca hacía una importación inicial de Steam al arrancar (el
   watcher solo reacciona a cambios *futuros*) — commit `b0b94ef`.
5. `UpdateService.checkNow()` no capturaba excepciones y rompía la garantía de
   "nunca un error de update visible" cuando la config es inerte (sin env vars) —
   commit `95727d1`.
6. Los scripts `rebuild-native-for-electron.mjs`/`rebuild-native-for-node.mjs` se
   reescribieron: ya no tienen la versión de `better-sqlite3` hardcodeada, y
   verifican con un `require()` real (no solo `existsSync`) qué binding están
   guardando o restaurando — mismos commits `1ef4ffd` y `b0b94ef`.

Todo verificado con `pnpm typecheck` + suite de tests (183/185, los 2 que fallan
son flakies de timing preexistentes en `UpdateService`, confirmados pasando en
aislamiento — no relacionados con estos cambios) + `pnpm knip` limpio.

## Cómo lanzar la app en modo dev en esta máquina (aprendido a las malas)

`better-sqlite3` necesita un binding nativo distinto para Node (tests) y para
Electron (app real) — no pueden coexistir en el mismo `.node` activo.

```powershell
# Para correr la app real (pnpm --filter @ycore/desktop dev):
# necesita el binding de Electron. El script lo hace solo, pero requiere
# Visual Studio Build Tools con MSVC cargado si tiene que recompilar:
& cmd.exe /c '"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" && cd /d "<repo>\apps\desktop" && node tools\rebuild-native-for-electron.mjs'

# Para correr pnpm test después, hay que volver al binding de Node:
node tools/rebuild-native-for-node.mjs
```

Si `pnpm test` falla con `NODE_MODULE_VERSION mismatch`, es el binding de Electron
todavía activo — correr `rebuild-native-for-node.mjs`. Si ese script dice "no hay
ningún binding de Node guardado ni activo", hay que recompilar desde cero con
`node-gyp rebuild --build-from-source` (ver el bloque MSVC de arriba, sin el
`--runtime=electron`).

## Qué NO se debe volver a proponer sin evidencia nueva

El usuario descartó explícitamente Windows Defender como causa de cualquier
problema de arranque de Electron en esta máquina. No reabrir esa hipótesis salvo
que aparezca evidencia directa y nueva que el usuario mismo acepte.

## Siguiente paso sugerido

Probar el motor de descargas (F4) en vivo — encolar una descarga real desde la UI
y confirmar que el ciclo `queued → downloading → verifying → extracting →
installing → done` se ve correctamente en la sección "Descargas" de la ventana.
