/**
 * `@ycore/updater-client` — cliente de actualizaciones propio (ADR-0003).
 *
 * Sirve como la única API pública que `apps/desktop/src/main/features/updates`
 * (todavía sin escribir) necesita: consultar si hay una actualización, y
 * verificar la cadena de confianza (firma Ed25519 + SHA-512) antes de
 * instalar. Sin dependencias de Electron: puro Node + Web Crypto, testeable
 * fuera de la app real.
 */

export { checkForUpdate, type CheckClientInput } from './check-client.js';
export { signCheckRequest } from './sign-request.js';
export { verifyManifestSignature, verifyArtifactSha512 } from './verify-manifest.js';
