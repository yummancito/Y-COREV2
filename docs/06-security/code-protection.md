# Protección de código

Detalle técnico de las medidas de [`threat-model.md`](threat-model.md) que tocan
directamente el código y el empaquetado de `apps/desktop`.

## HMAC anti-scraping (`X-YCore-Signature`)

`X-YCore-Signature: hex(HMAC-SHA256(YCORE_CLIENT_SECRET, clientId + version + channel))`,
calculado en `packages/updater-client/src/sign-request.ts` y verificado en
`services/update-worker/src/http/auth.ts` (`isValidClientSignature`).

**Esto no es autenticación real.** El secreto está embebido en el binario del cliente,
sin firmar (`apps/desktop` no firma código con un certificado comercial —
presupuesto 0 €): cualquiera con un desensamblador lo extrae. Su único propósito es
que un scraper trivial (`curl` en bucle sobre `/v1/check`) no funcione sin haber
mirado dentro del `.exe` primero. Documentarlo así, explícitamente, es lo que evita
que alguien construya encima de él asumiendo que protege algo — la seguridad real de
la cadena de actualización es la firma Ed25519 del manifest (ver [`signing.md`](signing.md)),
que no depende de este secreto en absoluto.

Consecuencias de este diseño:

- **HMAC inválido → `200` up-to-date**, nunca `403`. Un `403` es la señal que le dice
  al scraper que va por buen camino; `200` up-to-date no le confirma nada y no cambia
  el comportamiento del cliente legítimo.
- Se compara con **comparación en tiempo constante** (nunca `===` sobre el hex), tanto
  en `isValidClientSignature` como en `isValidAdminToken` — una diferencia de tiempo
  en la comparación sería en sí misma una fuga de información.
- Rotarlo obliga a publicar una versión nueva de la app (el secreto viaja embebido en
  el binario), así que solo se rota si aparece scraping real que lo justifique.

## Preload sin `invoke()` genérico

Ver [`../01-architecture/overview.md`](../01-architecture/overview.md) para el
diagrama completo. La pieza de seguridad concreta: `apps/desktop/src/preload/index.ts`
construye `window.ycore` enumerando las claves de `packages/ipc-contract` en tiempo de
compilación — no existe ningún método `window.ycore.invoke(canal, payload)` genérico
que acepte un string arbitrario. Llamar a un canal que no existe en el contrato es un
error de TypeScript en compilación, no algo que un script inyectado en el renderer
pueda intentar en runtime.

`contextIsolation: true` + `sandbox: true` + `nodeIntegration: false`
(`main/bootstrap/window.ts`) son lo que garantiza que el renderer no tenga ninguna
otra vía de acceso a Node ni a `ipcRenderer` directo salvo por ese bridge construido.

## Empaquetado (`apps/desktop/electron-builder.yml`)

- `asar: true` — empaqueta el código de la app en un único archivo `.asar`, en vez de
  dejar los `.js` sueltos y legibles en el directorio de instalación.
- `compression: normal` + `nsis.differentialPackage: true` — habilita el `.blockmap`
  que consume la descarga diferencial de `packages/updater-client` (ver ADR-0003). No
  es una medida de seguridad, pero corrige la deuda del v1
  (`compression: store` + `differentialPackage: false`, ~400 MB por actualización).
- `win.signAndEditExecutable: false` — **sin firma de código Authenticode**
  (presupuesto 0 €, sin certificado comercial). Windows SmartScreen puede advertir al
  usuario en la primera ejecución de un instalador nuevo; se acepta ese coste porque
  la cadena de confianza real (Ed25519 + SHA-512) no depende de la firma de Windows.

## Lo que falta configurar (ver `threat-model.md`, sección "Trabajo pendiente")

Electron Fuses, ASAR integrity, ofuscación selectiva del main, y sourcemaps fuera del
paquete distribuido — ninguna de las cuatro está configurada todavía en
`electron-builder.yml` ni en `electron.vite.config.ts`. Documentado ahí para no
repetirlo.
