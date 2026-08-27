# CI/CD

Qué corre automáticamente hoy, y qué está planeado pero no implementado todavía.

## Lo que existe hoy

### `.github/workflows/release-desktop.yml`

El único workflow del repo. Se dispara con un tag `v*`. Ver
[`release-process.md`](release-process.md) para el detalle completo de sus pasos
(build → firma → subida a R2 → registro en el Worker).

Incluye `pnpm check:all` como primer paso real — si el gate de calidad falla, el
resto del pipeline (empaquetado, firma, publicación) no llega a ejecutarse.

### Hooks locales (`.githooks/`)

No son CI en el sentido de GitHub Actions, pero cumplen el mismo papel antes de que el
código llegue a un PR:

- **`pre-commit`** → `tools/scripts/check-staged.mjs`: rechaza binarios, archivos
  >5 MB, `.md` sueltos en la raíz, y (para `services/`/`wrangler.jsonc`) cualquier
  referencia a `PRIVATE_KEY`/`SIGNING_KEY`.
- **Hook de escritura de archivo** → `tools/scripts/check-file-rules.mjs`: tamaño
  máximo (400 líneas/archivo, 60/función), `any` prohibido, `throw` cruzando
  fronteras, `eslint-disable` sin justificación, scripts sueltos en la raíz — bloquea
  la escritura antes de que el archivo llegue a existir con el problema.
- **Hook `Stop`** → `tools/scripts/check-done.mjs`: verifica que la documentación
  exigida por la tarea exista antes de darla por cerrada.

## Lo que se ejecuta manualmente hoy (`pnpm check:all`)

```
pnpm lint && pnpm typecheck && pnpm test && pnpm knip && pnpm check:docs && pnpm check:contract
```

Más los checkers específicos de `services/update-worker`:
`pnpm check:worker-routes` (un único `export default { fetch }`) y
`pnpm check:no-private-key` (ya cubierto también por el pre-commit hook).

Correrlo antes de cada commit/PR es responsabilidad de quien escribe el código — **no
hay todavía un workflow de GitHub Actions que lo corra automáticamente en cada PR.**

## Lo que está planeado pero no implementado (roadmap, sección A.2)

- **`.github/workflows/ci.yml`** — lint + typecheck + test + knip + boundaries en cada
  PR, replicando `pnpm check:all` en CI para que no dependa de que un humano se
  acuerde de correrlo en local.
- **`.github/workflows/deploy-worker.yml`** — desplegar `services/update-worker` con
  `wrangler deploy` al mergear cambios en esa carpeta (hoy el despliegue del Worker es
  manual).
- **`.github/workflows/deploy-landing.yml`** — desplegar `apps/web-landing` a
  Cloudflare Pages (hoy también manual).
- **`PULL_REQUEST_TEMPLATE.md`** — checklist de PR (doc / ADR / test / changeset) que
  el roadmap fija en la sección A.2, todavía sin crear.

Estos cuatro son trabajo de infraestructura de CI puro, no bloquean el desarrollo de
features — el gate de calidad ya existe como comando (`pnpm check:all`), solo falta
automatizarlo en GitHub Actions.
