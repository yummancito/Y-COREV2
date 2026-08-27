---
"@ycore/desktop": minor
---

Cierra el último tramo de la Fase 5: `.github/workflows/release-desktop.yml` publica
una release al empujar un tag `v*` — empaqueta con `electron-builder.yml` (NSIS,
diferencial habilitado, sin firma de código comercial), firma el manifest con Ed25519
(`tools/scripts/sign-release-manifest.mjs`, clave solo en un secret de CI), sube todo a
R2, y registra la release en el Worker con `ycore release` (rollout inicial 10%). Es el
único camino para publicar una release firmada: no existe forma de firmar desde un
portátil.
