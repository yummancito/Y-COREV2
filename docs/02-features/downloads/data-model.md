# Descargas — modelo de datos

## `DownloadState` (`@ycore/core-domain`)

Unión discriminada por `status`. Cada variante lleva solo los campos que ese estado
tiene sentido que lleve — ver [ADR-0004](../../adr/0004-motor-de-descargas.md), punto 2,
para la tabla completa de transiciones legales (`ALLOWED_TRANSITIONS`).

```ts
type DownloadStatus =
  | 'queued' | 'downloading' | 'paused' | 'verifying'
  | 'extracting' | 'installing' | 'done' | 'failed';

// downloading y paused llevan bytesDownloaded/bytesTotal.
// failed lleva el AppError que la produjo.
// El resto (queued, verifying, extracting, installing, done) solo lleva `id` y `status`.
```

## `DownloadMetadata` (`main/features/downloads/download-record.ts`)

Lo que no cambia con el estado: de dónde se descarga, a dónde va, qué hash se espera.
Separado de `DownloadState` a propósito — mezclarlos habría hecho que cada variante de
la unión discriminada cargara con campos que no le sirven.

```ts
interface DownloadMetadata {
  appId: number;
  sourceUrl: string;
  destinationPath: string;
  installPath: string;
  expectedSha256: string;
  etag: string | null;
  lastModified: string | null;
  segmentIndex: number;
  segmentCount: number;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}
```

`DownloadRecord = { state: DownloadState; metadata: DownloadMetadata }` es la forma que
usa todo lo que está por encima del repositorio.

## Tabla física `downloads` (`apps/desktop/src/main/db/schema.ts`)

Columnas planas, igual que `games` — el mapeo a `DownloadRecord` lo hace
`DownloadRepository`, la tabla no sabe nada de `core-domain`.

```sql
CREATE TABLE downloads (
  id TEXT PRIMARY KEY,
  app_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  source_url TEXT NOT NULL,
  destination_path TEXT NOT NULL,
  install_path TEXT NOT NULL,
  bytes_downloaded INTEGER NOT NULL DEFAULT 0,
  bytes_total INTEGER,
  etag TEXT,
  last_modified TEXT,
  expected_sha256 TEXT NOT NULL,
  segment_index INTEGER NOT NULL DEFAULT 0,
  segment_count INTEGER NOT NULL DEFAULT 1,
  error_code TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX downloads_active_app ON downloads (app_id)
  WHERE status NOT IN ('done', 'failed');
```

`speed`/`eta`/`percent` **no** son columnas: son derivados que cambian varias veces por
segundo y viajan solo en el evento de progreso (ver ADR-0004, punto 3).

El índice único parcial `downloads_active_app` es la mitad de la deduplicación (ADR-0004,
punto 4): impide, a nivel de SQLite, que exista más de una fila activa (`status` distinto
de `done`/`failed`) para el mismo `appId`. La otra mitad es el `Map<string,
AbortController>` en memoria de `DownloadService` (`inFlight`), que protege contra dos
llamadas IPC casi simultáneas abriendo dos streams sobre la misma fila — algo que el
índice de la DB no puede ver.

## Mapeo

`DownloadRepository` (`repository.ts`) es el único lugar que traduce entre la fila y
`DownloadRecord`. Al leer un estado `failed`, el `error_code` guardado se reconstruye
con `appError(code)` — `retriable` se recalcula por defecto según el código, porque la
tabla no tiene una columna `retriable` propia (ver el comentario en
`repository-save.test.ts`).

## Forma del canal IPC (`packages/ipc-contract/src/channels/downloads.ts`)

`downloadStateSchema` espeja `DownloadState` con un `z.discriminatedUnion('status', ...)`
— la misma forma, sin importar `core-domain` desde el contrato (regla de A.3: el
contrato no depende de tipos internos del dominio, para no acoplar la frontera IPC a
cómo esté modelado el estado por dentro).

```ts
// downloads.list.output
{ downloads: [{ state: DownloadState, appId: number }] }

// downloads.enqueue.input
{ appId: number, sourceUrl: string, installPath: string, expectedSha256: string /* 64 hex */ }

// downloads.enqueue.output
{ id: string }

// downloads.pause.input / downloads.cancel.input
{ id: string }
```

`downloads.pause`/`downloads.cancel` devuelven `{}` en éxito — no hay dato útil que
devolver más allá de "la operación se hizo"; el estado resultante se lee en el siguiente
`downloads.list` (polling).
