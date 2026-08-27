# Glosario

Términos usados en el código y la documentación sin explicarse cada vez.

## Steam

**AppID** — Identificador numérico único de una app en Steam (juego, DLC, herramienta).
`730` es Counter-Strike 2. Tipo `AppId` en `packages/core-domain`.

**Depot** — Un paquete de archivos dentro de un AppID (p. ej. el contenido base, un
idioma, una plataforma). Un juego puede tener varios depots; Steam descarga solo los
que aplican a tu configuración.

**`appmanifest_<appId>.acf`** — Archivo VDF que Steam escribe en `steamapps/` por cada
juego instalado: nombre, estado, tamaño en disco. `packages/steam-kit` lo parsea
(`parseAppManifest`).

**`libraryfolders.vdf`** — Archivo VDF que lista todas las carpetas de biblioteca de
Steam configuradas en la máquina (Steam permite varias, en distintos discos).
`parseLibraryFolders` en `packages/steam-kit`.

**VDF (Valve Data Format)** — El formato de texto propio de Valve para configuración
(parecido a JSON pero con su propia sintaxis). `parseVdf` en `packages/steam-kit` es el
parser genérico del que salen los demás.

**Manifest** (contexto de actualizaciones, no confundir con `appmanifest`) — El
`manifest.json` firmado con Ed25519 que describe una release de la propia app: versión,
hash SHA-512, tamaño. Ver `packages/update-contract/src/manifest.ts`.

## Actualizaciones (ADR-0003, ADR-0005)

**Rollout determinista** — En vez de repartir una actualización al azar, cada cliente
cae siempre en el mismo "bucket" (`SHA-256(clientId:version) mod 100`), así que subir
el `rollout` de 10% a 50% nunca saca a alguien que ya la había recibido — solo añade
gente. Ver `services/update-worker/src/domain/rollout.ts`.

**Kill-switch** — Marcar una versión instalada como bloqueada: el cliente en esa
versión recibe `status: "blocked"` y debe actualizar para seguir usando la app, incluso
si el modo mantenimiento está activo (el bloqueo pesa más). Comando `ycore block`.

**Modo mantenimiento** — Pausa global y silenciosa de las actualizaciones: el Worker
responde exactamente igual que "estás al día" a todo el mundo, sin que el cliente
pueda distinguirlo. Ver [`05-operations/maintenance-mode.md`](../05-operations/maintenance-mode.md).

**Manifest firmado** — Ver "Manifest" arriba. La firma Ed25519 se hace siempre en CI
(`tools/scripts/sign-release-manifest.mjs`), nunca en el Worker — es la propiedad que
hace que comprometer Cloudflare no comprometa las actualizaciones.

**`clientId`** — UUID v4 generado en el primer arranque de la app y persistido
localmente (tabla `settings`). Sirve solo para el rollout determinista — no es un
identificador de persona, el Worker no lo guarda asociado a nada.

## Arquitectura del repo

**Feature vertical** — Una carpeta con el mismo nombre en `main/features/<x>/` y
`renderer/features/<x>/`, comunicadas solo por canales `<x>.*` del contrato IPC. Ver
[`07-contributing/how-to-add-a-feature.md`](../07-contributing/how-to-add-a-feature.md).

**Boundary (frontera)** — Una regla de `eslint-plugin-boundaries` que dice qué carpeta
puede importar de qué otra. Ver [`01-architecture/boundaries.md`](../01-architecture/boundaries.md).

**`Result<T, AppError>`** — El tipo que reemplaza `throw` en toda frontera del repo
(IPC, servicio, plugin). Ver [`01-architecture/error-handling.md`](../01-architecture/error-handling.md).

**ADR (Architecture Decision Record)** — Un documento en `docs/adr/` que registra una
decisión de arquitectura, sus alternativas descartadas y sus consecuencias. Inmutable
una vez aceptado — un cambio de opinión es un ADR nuevo, no una edición.

**Changeset** — Un archivo en `.changeset/` (herramienta Changesets) que describe un
cambio de cara al usuario, para generar el `CHANGELOG.md` automáticamente.
