# Modelo de amenazas

Qué protege Y-CORE de verdad, qué es teatro que deliberadamente no se hace, y qué
sigue siendo trabajo pendiente. Contexto de por qué: presupuesto **0 €** — sin
certificado de firma de código comercial, sin licencias comerciales de protección.

## El objetivo real

**No es impedir el crackeo** — en una app Electron es imposible: el renderer es HTML/
JS/CSS que cualquiera puede leer con DevTools, y el main process es Node que se puede
desensamblar. El objetivo real, dos cosas:

1. **Un cliente crackeado es inútil sin el backend.** Toda la lógica de valor
   (decisión de qué versión toca, rollout, kill-switch, verificación) vive en
   `services/update-worker`, no en el cliente. Parchear el `.exe` no da acceso a nada
   que el Worker no quiera dar.
2. **Nadie puede distribuir una versión troyanizada que se haga pasar por oficial.**
   La cadena de confianza Ed25519 (ver [`signing.md`](signing.md)) es lo que garantiza
   esto — no depende de que el binario esté ofuscado ni protegido.

## Lo que protege de verdad, implementado hoy

- **Lógica de valor en el servidor.** `services/update-worker` decide rollout,
  mantenimiento, kill-switch — el cliente solo pregunta y obedece. Ver
  `docs/03-services/update-worker/README.md`.
- **Manifest firmado con Ed25519.** Un instalador o un manifest falsificado no pasa
  `verifyManifestSignature` — ver [`signing.md`](signing.md). Es la pieza que hace
  que comprometer Cloudflare (DNS, cuenta, bucket) no permita distribuir un binario
  arbitrario.
- **`X-YCore-Signature` (HMAC) del cliente hacia `/v1/check`.** Documentado
  explícitamente como **ofuscación anti-scraping, no autenticación real** — ver
  [`code-protection.md`](code-protection.md), sección correspondiente. Un scraper
  trivial no funciona sin haber mirado dentro del binario; alguien que sí lo hace, sí
  puede llamar al endpoint, pero eso no le da nada que el Worker no exponga
  igualmente a un cliente legítimo.
- **Preload sin `invoke()` genérico + `contextIsolation: true` + `sandbox: true`.** El
  renderer solo puede llamar a los canales que el contrato declara — ver ADR-0002 y
  [`../01-architecture/overview.md`](../01-architecture/overview.md). Esto no protege
  contra un atacante con acceso físico a la máquina del usuario, pero cierra el
  agujero real del v1 (`invoke(channel, ...)` sin allowlist).
- **`AppError` sin PII ni secretos en `context`, y `detail` nunca mostrado al
  usuario** — ver [`../01-architecture/error-handling.md`](../01-architecture/error-handling.md).
- **`clientId` no es un identificador de persona.** UUID v4 local, sin relación con
  hardware ni cuenta; el Worker no lo guarda asociado a nada (`check_stats` es
  agregado, sin columna de cliente). Ver
  [`../00-overview/glossary.md`](../00-overview/glossary.md).
- **Cero secretos en el cliente distribuido**, salvo el secreto HMAC anti-scraping
  (que es deliberadamente débil, ver arriba) — la clave privada Ed25519 nunca sale de
  `secrets.YCORE_SIGNING_KEY_BASE64` en CI (ver [`signing.md`](signing.md)).

## Lo que es teatro, y por qué deliberadamente no se hace

| Técnica descartada | Por qué no |
|---|---|
| Detección de debugger en JS | Se salta con un breakpoint condicional trivial |
| Ofuscar el renderer | 10x más lento en carga, cero protección real — DevTools ve el DOM igual |
| Cifrar el ASAR con una clave embebida en el binario | Es ROT13 con pasos extra: la clave de descifrado viaja con el propio binario |
| Comprobar el hash del propio `.exe` desde dentro del `.exe` | Se parchea el comprobador mismo |
| VMProtect / Themida u otro protector comercial | Cuestan dinero (presupuesto 0 €) y suelen disparar falsos positivos de antivirus |
| Licencias validadas offline | Si la validación es local, se parchea sin tocar el servidor |

## Trabajo pendiente (deuda de seguridad conocida, no implementado todavía)

- **Electron Fuses** (`RunAsNode`, `EnableNodeCliInspectArguments`,
  `EnableNodeOptionsEnvironmentVariable` desactivados): planeado en el roadmap
  (sección D), **no configurado todavía** en `electron-builder.yml` ni en el build.
  Sin esto, el ataque más fácil contra una app Electron (relanzar el `.exe` propio
  como proceso Node y leer/ejecutar lo que se quiera) sigue abierto.
- **ASAR integrity** (`EnableEmbeddedAsarIntegrityValidation` +
  `OnlyLoadAppFromAsar`): `electron-builder.yml` solo tiene `asar: true` (empaquetado),
  no la validación de integridad de ese `.asar` en runtime.
- **Ofuscación selectiva del main** (`javascript-obfuscator` en el bundle del main y
  plugins sensibles, nunca en el renderer): no configurada.
- **Sourcemaps fuera del paquete distribuido** (a un bucket privado para debugging):
  no configurado — hoy no hay pipeline de sourcemaps separado del build normal.

Estas cuatro piezas son baratas (sin coste de licencia) y quedan como trabajo pendiente
explícito antes de una distribución pública real — no bloquean el desarrollo ni el
uso interno de la app.
