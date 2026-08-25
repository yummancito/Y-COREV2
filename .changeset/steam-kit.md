---
"@ycore/steam-kit": minor
---

Añade `packages/steam-kit` (Fase 3): parsers puros de los formatos de Steam —
`parseVdf` (tokenizer VDF/KeyValues con comentarios `//`, escapes, tokens sin comillas
y claves duplicadas), `parseLibraryFolders` (bibliotecas múltiples, formato viejo y
moderno), `parseAppManifest` (con `needsRepair` para detectar instalaciones
interrumpidas), `parseLoginUsers` (SteamID64 activo) y `parseDepotKeys` (lectura de
claves de descifrado desde `config.vdf`). 40 fixtures/tests, sin Electron ni `node:fs`.
