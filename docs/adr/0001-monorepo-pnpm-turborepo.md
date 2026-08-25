# ADR-0001: Organizar el proyecto como monorepo pnpm + Turborepo con fronteras verificadas

- **Estado**: Aceptado
- **Fecha**: 2026-08-03
- **Decide**: @yummancito
- **Afecta a**: raíz del repo, `apps/*`, `packages/*`, `plugins/*`, `services/*`

## Contexto

Y-CORE v1 era un repo plano donde `electron/` (46.5k líneas) y `src/` (36.4k) se importaban
mutuamente sin ninguna barrera. Consecuencias medidas:

- Nada impedía que el renderer importara un módulo del main, ni que una parte de la UI
  importara lógica de negocio de otra sin relación.
- Coexistían `pnpm-workspace.yaml` y `package-lock.json`: dos gestores, un solo repo.
- La lógica valiosa (parsers de ACF/VDF, resolución de depots) estaba enterrada dentro del
  proceso main, así que **no se podía testear sin arrancar Electron**, y en la práctica no
  se testeaba.
- Tres `tsconfig.json` sueltos y un build en tres pasos encadenados a mano.

## Decisión

El repo es un **monorepo pnpm workspaces + Turborepo**, con las fronteras entre paquetes
verificadas por `eslint-plugin-boundaries` en CI.

Fronteras:

```
apps/desktop      → composición: ventanas, router IPC, features verticales
apps/web-landing  → landing pública (Astro)
packages/*        → lógica reutilizable y sin Electron
plugins/*         → módulos opcionales aislados (DRM, online-fix, remote-play)
services/*        → backend (Cloudflare Worker)
tools/*           → CLI del dev y scripts de build
```

Reglas de importación (nivel `error`):

```
renderer/features/*  → su dir, renderer/shared, ipc-contract, ui-kit, i18n, result
main/features/*      → su dir, main/platform, main/db, core-domain, steam-kit, logger, result
core-domain          → solo result   (CERO deps externas)
steam-kit            → core-domain, result
plugins/*            → ipc-contract, core-domain, result

Prohibido: renderer→main · main→renderer · featureA→featureB · renderer→node:fs
```

`pnpm` con symlinks estrictos hace que importar algo no declarado como dependencia falle
en tiempo de resolución, no solo en lint.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Repo plano con carpetas (como el v1) | No hay forma de impedir un import; las convenciones sin checker se erosionan. Ya lo probamos |
| npm/yarn workspaces | pnpm ya estaba en el v1 y sus symlinks estrictos son precisamente la garantía que buscamos; npm hoisting permite importar deps fantasma |
| Nx | Overkill: generadores y plugins que no necesitamos, y una capa de configuración propia que mantener |
| Repos separados por paquete | Versionado cruzado y PRs multi-repo para cualquier cambio de contrato. Coste enorme para un dev solo |

## Consecuencias

- **Positivas**: `core-domain` y `steam-kit` se testean en Node puro en milisegundos, sin
  Electron; borrar una feature es borrar dos carpetas y su sección del contrato; los plugins
  pueden romperse sin tumbar el build de la app base; Turborepo cachea builds.
- **Negativas / lo que aceptamos pagar**: más `package.json` que mantener; hay que declarar
  dependencias explícitamente en cada paquete; la curva inicial de configuración es mayor
  que un repo plano.
- **Revertir**: colapsar los paquetes en `apps/desktop` es mecánico, pero se perdería toda
  garantía de frontera. Exigiría un ADR que reemplace a este.

## Cómo se verifica que se cumple

```
pnpm lint       # eslint-plugin-boundaries + import/no-cycle en nivel error
pnpm typecheck  # referencias de proyecto TS respetan las fronteras
pnpm knip       # detecta deps declaradas y no usadas, y exports huérfanos
```
