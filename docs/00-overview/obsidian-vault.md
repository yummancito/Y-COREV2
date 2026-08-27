# `docs/` como vault de Obsidian

`docs/` es, además de la documentación en Markdown estándar que ya lee cualquier
editor o GitHub, una vault de Obsidian real (`docs/.obsidian/`) para navegarla con
grafo de enlaces, backlinks y búsqueda rápida.

## Por qué sigue siendo Markdown estándar, no wikilinks

`docs/.obsidian/app.json` fija `useMarkdownLinks: true` a propósito: todos los
enlaces internos siguen siendo `[texto](ruta/al/archivo.md)`, nunca
`[[wikilinks]]`. Dos razones, ninguna negociable:

1. **`pnpm check:docs` y los checkers del repo asumen Markdown estándar** — no
   parsean sintaxis de Obsidian. Un enlace en formato wikilink no se detectaría como
   roto por las herramientas existentes.
2. **La documentación tiene que seguir siendo legible sin Obsidian** — en GitHub, en
   un editor de texto plano, o generada por script (como `ipc-contract.md`, que
   `tools/scripts` regenera desde el código). Un wikilink no renderiza fuera de
   Obsidian.

Obsidian entiende perfectamente enlaces Markdown estándar para el grafo, las
backlinks y la navegación — no hace falta wikilinks para nada de eso.

## Cómo abrirla

1. Abre Obsidian.
2. "Open folder as vault" → selecciona la carpeta `docs/` de este repo (no la raíz
   del repo entero — `docs/` es la vault, el resto del monorepo es código).
3. Obsidian detecta `docs/.obsidian/` y carga la configuración ya fijada
   (`app.json`, `appearance.json`, `core-plugins.json`).

## Qué versiona el repo y qué no

`docs/.obsidian/app.json`, `appearance.json` y `core-plugins.json` se versionan —
son la configuración compartida (formato de enlace, qué paneles están activos por
defecto). `workspace.json`, `workspace-mobile.json` y el `data.json` de cada plugin
**no se versionan** (`.gitignore`): son estado local de cada persona (qué pestañas
tenía abiertas, el zoom del grafo), no algo que el repo deba fijar para todos.

## Qué archivos NO son parte de la vault de navegación normal

- `docs/01-architecture/ipc-contract.md` está generado (`pnpm --filter @ycore/desktop
  docs:ipc`) — se puede leer y enlazar como cualquier otro nota, pero nunca se edita
  a mano dentro de Obsidian: el próximo `docs:ipc` sobrescribiría cualquier cambio.
- Los `ipc-channels.md` de cada feature en `docs/02-features/<x>/` son punteros
  cortos a ese mismo archivo generado, mismo motivo.

## `aprendizaje.md` no vive en la vault

`aprendizaje.md` (raíz del repo, registro de errores resueltos) se queda fuera de
`docs/` a propósito — `.claude/CLAUDE.md` fija su ubicación en la raíz como una de
las cinco excepciones permitidas (junto a README/CONTRIBUTING/LICENSE/SECURITY/
CHANGELOG). Si quieres navegarlo desde Obsidian, ábrelo como una vault separada, o
usa un plugin de Obsidian que permita referenciar notas fuera de la vault activa
(no configurado aquí, para no introducir una dependencia sin necesidad real) — no lo
muevas a `docs/`, rompería la regla de ubicación fija de `.claude/CLAUDE.md`.

## Empezar a navegar

[`README.md`](../README.md) (el índice maestro) es el punto de entrada — desde ahí,
todo el resto de la documentación es alcanzable en dos o tres saltos de enlace como
mucho.
