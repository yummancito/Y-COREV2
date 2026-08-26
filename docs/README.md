# Documentación de Y-CORE V2

Índice maestro. Todo documento del proyecto vive aquí — **nunca en la raíz del repo**.

## Empezar por aquí

| Documento | Para qué |
|---|---|
| [Visión](00-overview/vision.md) | Qué es Y-CORE y qué no es |
| [Roadmap](00-overview/roadmap.md) | Las fases del proyecto y en cuál estamos |
| [Mapa del repo](00-overview/repo-map.md) | Qué hay en cada carpeta y por qué |
| [Glosario](00-overview/glossary.md) | appId, depot, manifest, fix, plugin… |

## Contribuir

| Documento | Para qué |
|---|---|
| [Cómo añadir una feature](07-contributing/how-to-add-a-feature.md) | **El documento más importante del repo** |
| [Cómo añadir un canal IPC](07-contributing/how-to-add-an-ipc-channel.md) | La frontera main↔renderer |
| [Estándares de código](07-contributing/coding-standards.md) | Límites, tipos, errores |
| [Guía de tests](07-contributing/testing-guide.md) | Qué testear y cuánto |
| [Reglas de documentación](07-contributing/documentation-rules.md) | Qué documentar y dónde |

## Arquitectura

| Documento | Para qué |
|---|---|
| [Visión general](01-architecture/overview.md) | Procesos y flujo de datos |
| [Contrato IPC](01-architecture/ipc-contract.md) | Cómo funciona la frontera |
| [Fronteras](01-architecture/boundaries.md) | Quién puede importar a quién |
| [Gestión de estado](01-architecture/state-management.md) | zustand vs TanStack Query |
| [Manejo de errores](01-architecture/error-handling.md) | `Result`, `AppError`, códigos |

## Features

Una carpeta por feature en [`02-features/`](02-features/). Cada una con `README.md`,
`data-model.md`, `ipc-channels.md`, `ui-flows.md` y `decisions.md`.

`pnpm check:docs` verifica que toda feature del código tiene la suya.

## Servicios y plugins

- [`03-services/update-worker/`](03-services/update-worker/) — el backend de actualizaciones
- [`04-plugins/plugin-api.md`](04-plugins/plugin-api.md) — el contrato que cumple todo plugin

## Operaciones

| Documento | Para qué |
|---|---|
| [Proceso de release](05-operations/release-process.md) | Publicar una versión |
| [Modo mantenimiento](05-operations/maintenance-mode.md) | Pausar las actualizaciones |
| [Playbook de incidentes](05-operations/incident-playbook.md) | Cuando una release rompe algo |
| [CI/CD](05-operations/ci-cd.md) | Qué corre y cuándo |

## Seguridad

- [Modelo de amenazas](06-security/threat-model.md) — qué protegemos de verdad y qué es teatro
- [Protección de código](06-security/code-protection.md)
- [Firma de releases](06-security/signing.md)

## Decisiones de arquitectura (ADR)

| # | Decisión | Estado |
|---|---|---|
| [0001](adr/0001-monorepo-pnpm-turborepo.md) | Monorepo pnpm + Turborepo con fronteras verificadas | Aceptado |
| [0002](adr/0002-contrato-ipc-unico.md) | Contrato IPC tipado único | Aceptado |
| [0003](adr/0003-abandonar-electron-updater.md) | Cliente de actualizaciones propio | Aceptado |
| [0004](adr/0004-motor-de-descargas.md) | Motor de descargas único, máquina de estados pura | Aceptado |
| [0005](adr/0005-update-worker-en-cloudflare.md) | Update-worker nativo, contrato Zod compartido, firma en CI | Aceptado |

Plantilla: [`adr/0000-template.md`](adr/0000-template.md).
Un ADR aceptado es **inmutable**: para cambiarlo se escribe uno nuevo que lo reemplaza.

## Excepciones

[`exceptions.md`](exceptions.md) — registro de cada `eslint-disable` con su justificación.
Que la lista sea corta es una métrica de salud del proyecto.
