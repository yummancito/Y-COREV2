# Actualizaciones — modelo de datos

## `UpdateStatus` (`main/features/updates/service.ts`)

Unión discriminada por `phase`, guardada solo en memoria en `UpdateService` — a
diferencia de `DownloadState` (ADR-0004), no sobrevive a un `kill -9`: si el proceso
muere a mitad, el siguiente arranque vuelve a `checkNow()` desde cero.

```ts
type UpdateStatus =
  | { phase: 'up-to-date' }
  | { phase: 'available'; version: string; mandatory: boolean; notes: { es: string; en: string } }
  | { phase: 'downloading'; version: string; bytesDownloaded: number; bytesTotal: number | null }
  | { phase: 'ready-to-install'; version: string; mandatory: boolean }
  | { phase: 'failed'; reason: 'download-failed' | 'verification-failed' }
  | { phase: 'blocked'; reason: string; message: { es: string; en: string }; forceUpdateTo: string };
```

`blocked` es el kill-switch (ADR-0003/ADR-0005): el Worker puede marcar una versión
instalada como tóxica, y el cliente debe mostrarlo de forma visible — a diferencia del
modo mantenimiento, que es indistinguible de `up-to-date` a propósito. `checkNow()`
comprueba `blocked` antes que cualquier otra cosa, para no confundirlo nunca con
`up-to-date` en silencio.

No hay transición explícita (`transition()`/`ALLOWED_TRANSITIONS` de `core-domain`):
`UpdateService` solo tiene un ciclo, no un grafo de estados con múltiples caminos —
`checkNow()` decide la fase completa de una vez por cada comprobación.

## Tabla física `settings` (`apps/desktop/src/main/db/schema.ts`)

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Genérica (clave-valor) en vez de una columna dedicada en otra tabla, porque hoy solo
guarda una cosa (`clientId`) y es la forma estándar de ir añadiendo ajustes sueltos sin
una migración por cada uno. `ClientIdRepository.getOrCreate()` es el único lugar que la
toca: lee la fila `key = 'clientId'`, y si no existe, genera un UUID v4 y la inserta.

## Forma del canal IPC (`packages/ipc-contract/src/channels/updates.ts`)

`updateStatusSchema` espeja `UpdateStatus` con un `z.discriminatedUnion('phase', ...)` —
misma regla que `downloadStateSchema` en la feature Descargas: el contrato no importa
tipos de `main/features/updates`, para no acoplar la frontera IPC a cómo esté modelado
el estado por dentro.

```ts
// updates.getStatus.input
{}

// updates.getStatus.output
{ status: UpdateStatus }

// updates.installNow.input / .output
{} / {}
```

`updates.installNow` no lleva ningún dato: solo dispara la acción sobre el estado
`ready-to-install` que ya está en memoria del lado main — no hay nada más que el
renderer necesite mandar.
