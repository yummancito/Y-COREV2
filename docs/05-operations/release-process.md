# Proceso de release

Cómo publicar una versión nueva de Y-CORE. El único camino soportado es un tag de
git — no existe un botón ni un comando que publique una release firmada desde un
portátil (ADR-0005, punto 5).

## Secrets que debe tener el repo de GitHub antes del primer release real

Ver ADR-0005 (firma) y ADR-0006 (config embebida en build) para el porqué de cada uno.
Se crean una sola vez, en Settings → Secrets and variables → Actions del repo:

| Secret | Para qué paso | De dónde sale el valor |
|---|---|---|
| `YCORE_SIGNING_KEY_BASE64` | Firmar el manifest (CI únicamente, nunca toca el cliente) | Clave **privada** Ed25519, PKCS#8 DER en base64. Generarla una vez y no volver a exponerla |
| `YCORE_WORKER_URL` | Compilar el bundle (embebido) + registrar la release + smoke test | La URL del Worker ya desplegado (`wrangler deploy` en `services/update-worker`) |
| `YCORE_CLIENT_SECRET` | Compilar el bundle (embebido) + smoke test | El mismo valor subido al Worker con `wrangler secret put YCORE_CLIENT_SECRET` — **deben coincidir exactamente** |
| `YCORE_MANIFEST_PUBLIC_KEYS` | Compilar el bundle (embebido) | Clave **pública** Ed25519 (32 bytes raw, base64), la que corresponde a `YCORE_SIGNING_KEY_BASE64`. Una o dos, coma-separadas si se está rotando (ADR-0005, punto 6.5) |
| `YCORE_ADMIN_TOKEN` | Registrar la release vía la CLI (nunca al cliente) | El mismo valor subido al Worker con `wrangler secret put YCORE_ADMIN_TOKEN` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Subir instalador/blockmap/manifest a R2 | Un R2 API Token creado en el dashboard de Cloudflare (R2 → Manage R2 API Tokens), permiso Object Read & Write sobre el bucket `ycore-releases` |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Smoke test: leer `check_stats` tras el `/v1/check` de prueba (ADR-0006, punto 5.3) | Un API Token de Cloudflare (dashboard → My Profile → API Tokens), permiso D1:Edit sobre la cuenta |

Si falta `YCORE_CLIENT_SECRET`/`YCORE_MANIFEST_PUBLIC_KEYS`/`YCORE_WORKER_URL` al
compilar, el paso "Compilar el proceso main con la config de updates embebida" del
workflow falla explícitamente (`YCORE_REQUIRE_UPDATE_CONFIG=1` fuerza esto) — no se
publica un `.exe` inerte por accidente.

## Publicar (automático, disparado por tag)

1. Actualiza `CHANGELOG.md`/changesets pendientes (`pnpm changeset version` si aplica).
2. Crea y empuja un tag `vX.Y.Z` (semver, sin certificado de firma — el número de
   versión es lo único que importa para el rollout).
3. `.github/workflows/release-desktop.yml` se dispara solo. Pasos, en orden (ver
   `docs/02-features/updates/README.md`, `docs/06-security/signing.md` y ADR-0006
   para el detalle de cada uno):
   - `pnpm check:all` — el mismo gate que cualquier PR. Si falla aquí, no se publica.
   - Compila el proceso main con `YCORE_WORKER_URL`/`YCORE_CLIENT_SECRET`/
     `YCORE_MANIFEST_PUBLIC_KEYS` embebidos (ADR-0006) — falla explícitamente si
     falta alguno, en vez de compilar un `.exe` inerte.
   - Empaqueta con `electron-builder.yml` (NSIS, diferencial habilitado).
   - Verifica que la config quedó embebida en el bundle **y** hace un smoke test
     real contra el Worker de producción, confirmando en `check_stats` (D1) que la
     firma HMAC fue aceptada — si `YCORE_CLIENT_SECRET` de GitHub y el del Worker
     se desincronizaron, el release se detiene aquí (ADR-0006, punto 5.3).
   - Firma el manifest con Ed25519 (`sign-release-manifest.mjs`, clave solo en el
     secret de CI).
   - Sube instalador + `.blockmap` + manifest a R2.
   - Registra la release en el Worker con `ycore release` — **rollout inicial 10%**.

## Subir el rollout (manual, tras vigilar)

El tag solo publica al 10%. Subir el porcentaje es una decisión humana, no automática:

```bash
pnpm --filter @ycore/cli ycore stats --days 1
# revisa que no haya un salto anómalo de errores/crashes reportados por otro canal
pnpm --filter @ycore/cli ycore rollout --channel stable --rollout 50 --actor <tu-nombre>
# ... y más tarde
pnpm --filter @ycore/cli ycore rollout --channel stable --rollout 100 --actor <tu-nombre>
```

No hay un intervalo de tiempo fijo entre pasos — la señal es "no hay indicios de
problemas", no "ya pasaron X horas".

## Si algo sale mal después de publicar

Ver [`incident-playbook.md`](incident-playbook.md) para `yank`/`block`, y
[`maintenance-mode.md`](maintenance-mode.md) si necesitas pausar todo mientras
investigas.

## Verificación end-to-end (roadmap Fase 5, criterio de HECHO)

**Estado a 2026-08-27**: el Worker ya está desplegado en una cuenta real de Cloudflare
(`services/update-worker`, KV+D1+R2 creados, migraciones aplicadas) y varios de los 6
pasos ya se verificaron en vivo contra él. Los pasos que siguen pendientes necesitan un
release real (par de claves Ed25519, instalador compilado y firmado, GitHub Secrets de
la tabla de arriba):

1. Instalar una versión `X.Y.Z` limpia en una máquina de prueba. **Pendiente** — aún no
   se ha publicado ninguna release real (con instalador firmado) por este proceso.
2. Publicar `X.Y.Z+1` siguiendo este mismo proceso. **Pendiente**, mismo motivo.
3. Confirmar que la app instalada se actualiza sola (comprobación → descarga →
   verificación → banner → instalar). **Pendiente** de 1 y 2.
4. `ycore maintenance on` → el cliente deja de ver updates **sin ningún error ni
   popup** → `off` → vuelve a verlos. **Verificado en vivo** contra el Worker real:
   `POST /v1/admin/maintenance` con `--on`/`--off` y `GET /v1/check` confirmando
   `up-to-date` indistinguible en ambos casos.
5. Manipular a mano el `sha512` de una release en D1 y confirmar que el cliente
   rechaza el instalador (falla `verifyArtifactSha512`, `UpdateStatus` queda en
   `failed`, nunca se ejecuta el instalador). **Pendiente** de tener una release real
   instalada localmente para observar el rechazo del lado del cliente — el ciclo
   `release publish → /v1/check (update-available) → /v1/download` sí se verificó de
   punta a punta con datos sintéticos (ver `aprendizaje.md`, 2026-08-27).
6. Medir que el instalador completo pesa menos de 120 MB y que el update diferencial
   (cuando exista — ver deuda pendiente en `docs/02-features/updates/decisions.md`)
   pesa menos de 25 MB. **Pendiente** de un instalador real compilado.

Lo que sí se verificó sin necesitar un release real: el mecanismo de firma/verificación
Ed25519 en sí (`sign-release-manifest.mjs` + `verifyManifestSignature`, con un par de
claves generado al vuelo — ver `docs/06-security/signing.md`), el ciclo completo de
mantenimiento contra el Worker real (punto 4), y el ciclo de publicar/consultar/
descargar una release con datos sintéticos (punto 5, parcial).
