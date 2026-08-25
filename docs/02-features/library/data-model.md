# Biblioteca — modelo de datos

## Entidad de dominio (`packages/core-domain`)

```ts
interface Game {
  appId: number;
  name: string;
  installation: Installation | null;
}

interface Installation {
  path: string;               // carpeta de instalación
  executablePath: string | null;  // null hasta que steam-kit (Fase 3) lo resuelva
  sizeOnDiskBytes: number;
  lastPlayedAt: string | null;    // ISO 8601
}
```

`installation: null` significa que el juego está en el catálogo pero no instalado en esta
máquina. `executablePath: null` (con `installation` no nulo) significa que hay carpeta
pero todavía no se sabe qué ejecutar dentro — ese caso produce `AppError` `unknown` al
intentar lanzar (ver `resolveLaunchCommand` en `packages/core-domain/src/launch.ts`).

## Tabla física (`apps/desktop/src/main/db/schema.ts`)

```sql
CREATE TABLE games (
  app_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  installation_path TEXT,
  executable_path TEXT,
  size_on_disk_bytes INTEGER,
  last_played_at TEXT
);
```

Columnas planas y nullable, no un JSON anidado — SQLite no tiene un tipo de objeto
nativo, y columnas planas permiten indexar/filtrar por instalación más adelante (p. ej.
"juegos instalados" = `WHERE installation_path IS NOT NULL`).

## Mapeo

`LibraryRepository` (`repository.ts`) es el único lugar que traduce entre ambas formas:
`installationPath === null` en la fila se convierte en `installation: null` en el `Game`;
si no es null, se arma el objeto `Installation` completo. El servicio y los handlers de
la feature nunca ven la fila cruda de Drizzle, solo `Game`/`Installation`.
