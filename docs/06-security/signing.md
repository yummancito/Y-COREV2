# Firma de releases

La cadena de confianza real de las actualizaciones: Ed25519 sobre el manifest, y
SHA-512 sobre el instalador. Es lo que garantiza (ADR-0003, ADR-0005) que "aunque
alguien secuestre el DNS, la cuenta de Cloudflare o el bucket R2, no puede hacer que la
app instale un binario que no fue firmado con la clave privada real".

## Dónde vive la clave privada, y dónde nunca

**La clave privada Ed25519 solo existe en `secrets.YCORE_SIGNING_KEY_BASE64` de
GitHub Actions.** Nunca en `services/update-worker` (el Worker solo almacena y sirve
el manifest ya firmado, nunca firma nada — ver
`docs/03-services/update-worker/README.md`), nunca en un disco de desarrollador,
nunca en un `.env` local.

`tools/scripts/check-no-private-key.mjs` corre en CI y en el hook de pre-commit:
grep de `PRIVATE_KEY`, `BEGIN PRIVATE KEY` y `SIGNING_KEY` bajo `services/` y en
`wrangler.jsonc`. Un despiste que meta la clave donde no debe se bloquea antes de
llegar a producción.

## Quién firma, y cómo

`tools/scripts/sign-release-manifest.mjs` es el único código que toca la clave
privada, y solo corre dentro de `.github/workflows/release-desktop.yml` (nunca en
local con la clave real). Recibe la clave por la variable de entorno
`YCORE_SIGNING_KEY_BASE64` (PKCS#8 DER en base64) — nunca como argumento de línea de
comandos, para que no quede en logs de CI ni en el historial de shell.

Pasos, en orden:

1. Calcula `sha512` y `size` del instalador ya empaquetado
   (`electron-builder.yml` → NSIS), y `sha512` del `.blockmap` si existe.
2. Construye el manifest sin firmar: `{ version, channel, sha512, size,
   blockmapSha512, notes }`.
3. Firma con `node:crypto` (Ed25519 nativo — cero dependencias externas) sobre el
   JSON de esos campos exactos, en ese orden.
4. Escribe `manifest.json` = `{ ...unsigned, signature }` a disco.

El pipeline sube ese `manifest.json` firmado junto al instalador y el `.blockmap` a
R2, y llama a `ycore release` (`tools/cli`) para que el Worker registre la release —
el Worker recibe el manifest ya firmado, nunca lo reconstruye.

## Quién verifica, y cómo

`packages/updater-client/src/verify-manifest.ts`, desde
`apps/desktop/src/main/features/updates/service.ts`, antes de instalar cualquier
cosa:

1. **`verifyManifestSignature(manifest, publicKeysBase64)`** — verifica la firma
   Ed25519 con Web Crypto (`crypto.subtle.verify`) contra una o más claves públicas
   embebidas en el binario. Acepta la firma si es válida contra **al menos una** de
   las claves — eso es lo que permite rotar sin romper clientes viejos (ver
   "Rotación" más abajo).
2. **`verifyArtifactSha512(filePath, expectedSha512)`** — una vez la firma del
   manifest es válida (y por tanto se confía en el `sha512` que declara), calcula el
   hash real del instalador ya descargado y lo compara.

Si cualquiera de las dos comprobaciones falla, el archivo se descarta y **nunca se
ejecuta nada** — el `UpdateStatus` pasa a `failed` con `reason:
'verification-failed'`, y el siguiente ciclo de `checkNow()` lo reintenta desde cero
con una URL firmada nueva.

## Rotación de claves

El cliente acepta dos claves públicas embebidas a la vez (la actual y la siguiente).
Rotar:

1. Añadir la clave pública nueva a `apps/desktop` (variable de entorno
   `YCORE_MANIFEST_PUBLIC_KEYS`, coma-separada — ver
   `apps/desktop/src/main/bootstrap/update-scheduler.ts`).
2. Publicar una versión de la app que acepte ambas claves.
3. Esperar a que esa versión se propague a la base de usuarios.
4. Solo entonces, cambiar `YCORE_SIGNING_KEY_BASE64` en GitHub Secrets a la clave
   privada nueva.

El Worker no participa en ninguno de estos pasos — no conoce ninguna clave privada ni
pública, solo sirve bytes.

## Verificación local del mecanismo (sin cuenta de Cloudflare)

`sign-release-manifest.mjs` se verificó de extremo a extremo generando un par de
claves Ed25519 al vuelo (`node:crypto`), firmando un manifest de prueba, y
confirmando con `crypto.subtle.verify` (el mismo mecanismo exacto que usa
`verifyManifestSignature`) que la firma es válida. Ese ciclo completo — firmar en un
lado, verificar en el otro, con Web Crypto en ambos — es lo que da confianza en que
el pipeline real (con la clave de producción) producirá manifests que el cliente
real acepta, sin necesitar credenciales de Cloudflare para probarlo.

Lo que **no** se ha podido verificar desde este entorno: el pipeline completo contra
R2/D1/KV reales, y que Windows SmartScreen se comporte como se espera con un
instalador sin firma Authenticode — ver `threat-model.md` y
`docs/02-features/updates/README.md`, sección "Sin verificar todavía".
