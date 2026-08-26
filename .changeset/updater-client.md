---
"@ycore/updater-client": minor
"@ycore/eslint-config": minor
---

Añade `packages/updater-client` (Fase 5, ADR-0003/ADR-0005): cliente de
actualizaciones para el main process de Electron. `checkForUpdate` consulta el Worker
y trata cualquier fallo — de red, de timeout, de status HTTP, o de validación contra
`CheckResponseSchema` — como `up-to-date` en silencio, tal como exige el ADR-0003.
`signCheckRequest` calcula el HMAC-SHA256 de la request. `verifyManifestSignature`
verifica la firma Ed25519 del manifest contra una o más claves públicas (rotación de
claves). `verifyArtifactSha512` verifica el instalador ya descargado antes de
ejecutarlo. Paquete sin dependencias de Electron, testeado con un servidor HTTP real y
pares de claves Ed25519 generados en el propio test.

`@ycore/eslint-config`: la regla de boundaries `updater-client → update-contract,
result` pasa de ser una regla sin código a gobernar código real.
