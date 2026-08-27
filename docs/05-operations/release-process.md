# Proceso de release

Cómo publicar una versión nueva de Y-CORE. El único camino soportado es un tag de
git — no existe un botón ni un comando que publique una release firmada desde un
portátil (ADR-0005, punto 5).

## Publicar (automático, disparado por tag)

1. Actualiza `CHANGELOG.md`/changesets pendientes (`pnpm changeset version` si aplica).
2. Crea y empuja un tag `vX.Y.Z` (semver, sin certificado de firma — el número de
   versión es lo único que importa para el rollout).
3. `.github/workflows/release-desktop.yml` se dispara solo. Pasos, en orden (ver
   `docs/02-features/updates/README.md` y `docs/06-security/signing.md` para el
   detalle de cada uno):
   - `pnpm check:all` — el mismo gate que cualquier PR. Si falla aquí, no se publica.
   - Empaqueta con `electron-builder.yml` (NSIS, diferencial habilitado).
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

## Verificación end-to-end (manual, requiere cuenta real de Cloudflare)

**No está automatizado y no se ha podido verificar desde este entorno de desarrollo**
(sin credenciales de Cloudflare/GitHub reales). Los 6 pasos que sí hay que correr
antes de confiar en una release real, tal como los fija el roadmap (Fase 5, criterio
de HECHO):

1. Instalar una versión `X.Y.Z` limpia en una máquina de prueba.
2. Publicar `X.Y.Z+1` siguiendo este mismo proceso.
3. Confirmar que la app instalada se actualiza sola (comprobación → descarga →
   verificación → banner → instalar).
4. `ycore maintenance on` → el cliente deja de ver updates **sin ningún error ni
   popup** → `off` → vuelve a verlos.
5. Manipular a mano el `sha512` de una release en D1 y confirmar que el cliente
   rechaza el instalador (falla `verifyArtifactSha512`, `UpdateStatus` queda en
   `failed`, nunca se ejecuta el instalador).
6. Medir que el instalador completo pesa menos de 120 MB y que el update diferencial
   (cuando exista — ver deuda pendiente en `docs/02-features/updates/decisions.md`)
   pesa menos de 25 MB.

Lo que sí se verificó localmente sin necesitar esa cuenta: el mecanismo de firma/
verificación Ed25519 en sí (`sign-release-manifest.mjs` + `verifyManifestSignature`),
con un par de claves generado al vuelo — ver `docs/06-security/signing.md`.
