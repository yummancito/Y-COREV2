# Fronteras (quién importa a quién)

Implementado en `packages/eslint-config/rules-de-boundaries.js` con
`eslint-plugin-boundaries` — no es una convención, es una regla de ESLint que falla el
build si se rompe. Este documento explica el porqué; la fuente de verdad de la matriz
exacta es siempre el archivo `.js`.

## Por qué una regla y no solo disciplina

Una regla `no-restricted-imports` a mano no escala: cada feature nueva tendría que
repetir sus propias excepciones. `eslint-plugin-boundaries` declara **tipos** de
carpeta (por patrón glob) y una matriz `from -> allow` una sola vez; cualquier import
que no esté en la matriz falla en `pnpm lint`, con un mensaje que explica por qué.

## Los tipos declarados

| Tipo | Patrón | Qué es |
|---|---|---|
| `renderer-feature` | `apps/desktop/src/renderer/features/*/**` | Una feature vertical, lado renderer |
| `renderer-shared` | `apps/desktop/src/renderer/shared/**` | Código compartido entre features del renderer |
| `main-feature` | `apps/desktop/src/main/features/*/**` | Una feature vertical, lado main |
| `main-platform` | `apps/desktop/src/main/platform/**` | Único código que habla con el SO (spawn, registro) |
| `main-db` | `apps/desktop/src/main/db/**` | Esquema y apertura de la base de datos |
| `main-ipc` | `apps/desktop/src/main/ipc/**` | El router único y el registry |
| `preload` | `apps/desktop/src/preload/**` | El puente `contextBridge` |
| `core-domain` | `packages/core-domain/**` | Tipos y reglas puras, sin Electron ni `node:fs` |
| `steam-kit` | `packages/steam-kit/**` | Parsers de VDF/ACF, puros |
| `ipc-contract` | `packages/ipc-contract/**` | El contrato de canales `<feature>.<verbo>` |
| `update-contract` | `packages/update-contract/**` | Schemas Zod compartidos por el Worker y el cliente de updates |
| `updater-client` | `packages/updater-client/**` | Cliente HTTP de actualizaciones |
| `update-worker` | `services/update-worker/**` | El Worker de Cloudflare |
| `cli` | `tools/cli/**` | La CLI `ycore` |
| `logger` / `result` | `packages/logger,result/**` | Utilidades transversales sin lógica de producto |
| `ui-kit` / `i18n` | `packages/ui-kit,i18n/**` | Reservados, sin código todavía |
| `plugin` | `plugins/*/**` | Reservado para la Fase 7+ |

## La matriz, resumida

- **Una feature nunca importa de otra feature** (ni en main ni en renderer). Si dos
  necesitan lo mismo, esa lógica sube a `core-domain`. Es la regla que impidió que
  volviera a pasar lo del v1 (`useLibraryStore` + `useLibraryV2Store`).
- **`main-ipc` es el único que puede importar `main-feature`** — el router es el único
  lugar permitido para orquestar features vía IPC; una feature nunca importa a otra
  feature ni siquiera a través del router.
- **`preload` solo puede importar `ipc-contract`** — nunca una feature, nunca
  Electron más allá de `contextBridge`/`ipcRenderer`.
- **`core-domain` solo puede importar `result`** — tiene que seguir siendo puro y
  testeable sin Electron.
- **`update-contract` no puede importar nada**, ni siquiera `result` — es
  exclusivamente schemas Zod compartidos entre dos artefactos compilados por separado
  (el Worker y la app), y no debe arrastrar ninguna dependencia del resto del repo.
- **`cli` solo puede importar `update-contract`** — habla HTTP con el Worker
  (`fetch`), no necesita `result` ni ningún otro paquete de producto.

## Qué pasa si rompes una regla

`pnpm lint` falla con el mensaje personalizado de la regla (cada entrada de la matriz
tiene su propio `message` explicando el porqué, no solo "import no permitido"). No hay
forma de silenciarlo con `eslint-disable` sin que `check-file-rules.mjs` lo bloquee —
ver [`../exceptions.md`](../exceptions.md) si de verdad hace falta una excepción
documentada.
