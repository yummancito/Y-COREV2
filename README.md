# Y-CORE V2

Gestor de juegos de Steam para Windows. Biblioteca, descargas, y actualizaciones de la
propia app — reconstruido desde cero con cero deuda técnica como prioridad número uno.
Closed-source, sin presupuesto, Windows-only.

Ver [`docs/00-overview/vision.md`](docs/00-overview/vision.md) para qué es y qué no es
este proyecto, y [`docs/00-overview/roadmap.md`](docs/00-overview/roadmap.md) para el
estado real de cada fase.

## Empezar

```bash
pnpm install
pnpm --filter @ycore/desktop dev
```

Requiere Node 22+, pnpm, y Visual Studio Build Tools (workload C++) para compilar
`better-sqlite3` — ver `aprendizaje.md` si el build nativo falla.

## Estructura

Monorepo pnpm workspaces + Turborepo. Ver
[`docs/00-overview/repo-map.md`](docs/00-overview/repo-map.md) para qué hay en cada
carpeta, y [`docs/01-architecture/overview.md`](docs/01-architecture/overview.md) para
cómo se comunican entre sí.

```
apps/desktop/          la app real (Electron + React)
apps/web-landing/      landing estática, Astro
packages/              código compartido: dominio puro, contrato IPC, cliente de updates...
services/update-worker/  backend de actualizaciones (Cloudflare Worker)
tools/cli/             CLI ycore para administrar releases
tools/scripts/         checkers que hacen cumplir las reglas del repo
docs/                  toda la documentación — ver docs/README.md
```

## Documentación

[`docs/README.md`](docs/README.md) es el índice maestro. `docs/` es también una vault
de Obsidian navegable — ver
[`docs/00-overview/obsidian-vault.md`](docs/00-overview/obsidian-vault.md).

## Contribuir

Ver [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licencia

Privado, sin licencia pública (`UNLICENSED`). Todos los derechos reservados.
