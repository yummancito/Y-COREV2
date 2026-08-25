# Mapa del repositorio

Para qué sirve: da la ubicación real de cada carpeta del monorepo, para no tener que
adivinarla leyendo el roadmap. Se actualiza cada vez que se añade una carpeta nueva
(regla en `.claude/CLAUDE.md`).

Si esta lista y la estructura real del repo no coinciden, gana la estructura real —
abre un issue para corregir este archivo.

---

## `apps/`

| Carpeta | Qué es | Estado |
|---|---|---|
| `apps/desktop` | App de escritorio Electron (main, preload, renderer). El producto. | Fase 1: router IPC único, preload sin invoke() genérico, ventana con contextIsolation/sandbox on. Sin features todavía. |
| `apps/web-landing` | Landing estática "próximamente", en Astro. Se despliega en Cloudflare Pages. | Contenido inicial hecho — ver `docs/00-overview/repo-map.md#apps-web-landing`. |

### `apps/desktop`

```
apps/desktop/
├── electron.vite.config.ts     un config para main+preload+renderer, HMR en los tres
├── src/
│   ├── main/
│   │   ├── index.ts             bootstrap, <150 líneas
│   │   ├── bootstrap/           window.ts (webPreferences seguros), lifecycle.ts
│   │   └── ipc/
│   │       ├── router.ts        ÚNICO ipcMain.handle del repo (ADR-0002)
│   │       ├── registry.ts      mapa canal → handler
│   │       ├── check-contract.ts   pnpm check:contract — correspondencia contrato↔registry
│   │       └── generate-docs.ts    pnpm docs:ipc — genera docs/01-architecture/ipc-contract.md
│   ├── preload/
│   │   ├── index.ts             expone window.ycore, sin invoke() genérico
│   │   └── build-bridge.ts       arma el árbol {namespace: {verbo: fn}} desde el contrato
│   └── renderer/                React 19 mínimo, prueba window.ycore.app.ping()
```

Sin `main/features/*` ni `renderer/features/*` todavía — la primera feature vertical
(biblioteca) es Fase 2.

### `apps/web-landing`

Astro puro, sin framework de UI (decisión del roadmap, sección A.1: "estático, 0 €, sin
React"). Build reproducible con Docker para no depender del entorno de cada PC.

```
apps/web-landing/
├── Dockerfile              build reproducible: node:22-slim + pnpm fijado
├── docker-compose.yml      dev server con hot reload en contenedor
├── astro.config.mjs
├── src/
│   ├── layouts/BaseLayout.astro   <head> común a toda página
│   ├── components/Icon.astro      iconos SVG centralizados (grandes, visibles)
│   └── pages/index.astro          única página por ahora
└── public/
    ├── favicon.svg
    └── styles/global.css          fondo oscuro, sin bordes divisorios entre secciones
```

Decisiones de estilo (a propósito distintas de cualquier referencia externa):

- Fondo oscuro, tipografía clara — el público son jugadores en Windows.
- Iconos SVG dimensionados para ser visibles (36-48px), nunca glifos diminutos.
- Las secciones se separan por espaciado y un degradado sutil de superficie
  (`.seccion--alterna`), no por un `border-top` marcado.

## `packages/`

| Carpeta | Qué es | Estado |
|---|---|---|
| `packages/result` | `Result<T, AppError>` — la pieza que hace cumplir "prohibido throw cruzando fronteras". | Implementado, con tests, cobertura 100%. |
| `packages/logger` | `createLogger(scope)` — el único logger de main/preload/renderer. Formato legible en dev, JSON en producción. | Implementado, con tests. |
| `packages/tsconfig` | `tsconfig` base compartido por todo el monorepo. | Implementado. |
| `packages/eslint-config` | ESLint 9 flat config compartida: límites de tamaño (B.2), boundaries (B.3), no-any y no-raw-ipc (B.1/B.6). | Implementado. |
| `packages/ipc-contract` | El corazón (ADR-0002): mapa de canales IPC con Zod input/output, `.describe()` obligatorio verificado en runtime. | Implementado, con tests, cobertura 100%. Solo el canal de referencia `app.ping`. |

Las demás carpetas de `packages/` que aparecen en el roadmap (`core-domain`, `steam-kit`,
`updater-client`, `ui-kit`, `i18n`) todavía no existen — se crean en las fases
correspondientes (ver `docs/00-overview/roadmap.md`).

## `services/` y `plugins/`

Vacíos por ahora. `services/update-worker` es Fase 5; `plugins/*` es Fase 7+.

## `tools/`

| Carpeta | Qué es |
|---|---|
| `tools/scripts` | Checkers en Node puro que hacen cumplir las reglas de `.claude/CLAUDE.md`: `check-file-rules.mjs` (hook de Write/Edit), `check-docs.mjs`, `check-done.mjs` (hook Stop), `check-staged.mjs` (pre-commit). |
| `tools/cli` | CLI `ycore` para el toggle de mantenimiento y releases. Fase 5. |

## Raíz

Solo existen en la raíz: `README.md`, `CONTRIBUTING.md`, `LICENSE.md`, `SECURITY.md`,
`CHANGELOG.md` y `aprendizaje.md` (registro de errores resueltos, regla de
`.claude/CLAUDE.md`). Cualquier otro `.md` en la raíz es una violación de R2 y el
checker lo bloquea.
