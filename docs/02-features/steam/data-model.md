# Steam — modelo de datos

Esta feature no introduce ninguna entidad de dominio propia — su único trabajo es
producir `Game[]` (`@ycore/core-domain`, la misma entidad que usa la feature Biblioteca)
a partir de lo que hay en disco, y guardarlo con `LibraryRepository.upsertMany`.

## De `appmanifest_*.acf` a `Game`

`packages/steam-kit` parsea el ACF a `AppManifest` (formato propio de Steam). El
`library-scanner.ts` de esta feature traduce eso a `Game`:

```ts
interface AppManifest {
  appId: string;
  name: string;
  installDir: string;
  stateFlags: number;
  sizeOnDiskBytes: number;
  lastUpdatedAtSeconds: number;
  lastPlayedAtSeconds: number;
  buildId: string;
}
```

```
Game.appId                        = Number.parseInt(manifest.appId, 10)
Game.name                         = manifest.name
Game.installation.path            = <steamapps>/common/<manifest.installDir>
Game.installation.executablePath  = null   (sin resolver todavía, ver README)
Game.installation.sizeOnDiskBytes = manifest.sizeOnDiskBytes
Game.installation.lastPlayedAt    = ISO 8601, o null si lastPlayedAtSeconds es 0
```

Un juego encontrado por el escaneo siempre tiene `installation` no nulo — si aparece en
`steamapps/appmanifest_*.acf` es porque está instalado. `Game` con `installation: null`
(catálogo sin instalar) solo existe hoy si se inserta a mano; nada en Steam produce ese
estado todavía.

## Multi-biblioteca

Steam permite varias carpetas de biblioteca (por ejemplo, un segundo disco). La principal
se deriva de la ruta de instalación (`<steamPath>/steamapps`); las adicionales están
declaradas en `<principal>/libraryfolders.vdf`, parseado con `parseLibraryFolders` de
`@ycore/steam-kit`. Cada carpeta se escanea de forma independiente y los resultados se
concatenan — un juego con el mismo `appId` en dos bibliotecas no debería ocurrir en la
práctica (Steam no lo permite), así que no hay deduplicación explícita más allá del
`onConflictDoUpdate` por `appId` que ya hace `upsertMany`.

## Persistencia

Sin tabla propia. `SteamService.importLibrary` llama a
`LibraryRepository.upsertMany(games)`, que inserta o actualiza filas en la misma tabla
`games` que usa `main/features/library` — ver
[`docs/02-features/library/data-model.md`](../library/data-model.md) para el esquema
físico.
