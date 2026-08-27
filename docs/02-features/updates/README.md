# Feature: Actualizaciones

Fase 5 del roadmap (ADR-0003, ADR-0005). Consume `packages/updater-client` para que la
propia app se actualice: comprueba periódicamente si hay una versión nueva, la descarga,
verifica su cadena de confianza completa (Ed25519 + SHA-512), y deja que el usuario
decida cuándo instalarla.

## Qué hace

- Comprueba actualizaciones cada 6 horas (y una vez al arrancar) contra
  `services/update-worker`, usando el `clientId` estable persistido en la tabla
  `settings` (ADR-0005, punto 6: debe ser estable entre arranques para el rollout).
- Si hay una versión disponible, la descarga en segundo plano, descarga el
  `manifest.json` firmado con Ed25519 por el pipeline de CI, verifica esa firma contra
  las claves públicas embebidas, y verifica el SHA-512 del instalador ya descargado
  contra el que el manifest (ya verificado) declara.
- Si cualquier paso de la cadena de confianza falla, la actualización queda en
  `failed` y **nunca se ejecuta nada** — el siguiente ciclo de `checkNow()` lo
  reintenta desde cero.
- Nunca instala sola: cuando la actualización queda `ready-to-install`, el usuario ve un
  aviso (`UpdateBanner`) con un botón "Instalar y reiniciar"; solo entonces se lanza el
  instalador NSIS en modo silencioso (`/S`) y Y-CORE se cierra.
- Cualquier fallo de red, timeout, o respuesta que no valide contra el schema Zod se
  trata como "estás al día" en silencio (ADR-0003) — el usuario nunca ve un error de
  comprobación, solo de descarga/verificación una vez que sabe que hay algo nuevo.

## Cómo encaja

```
apps/desktop/src/main/features/updates/
  client-id-repository.ts   ClientIdRepository: lee/genera el clientId estable (tabla settings)
  download.ts               downloadToFile/downloadJson: I/O de red, sin reanudación por Range
  service.ts                UpdateService: orquesta checkForUpdate -> descarga -> verificación
  handlers.ts                traduce dominio <-> forma exacta del contrato IPC
  index.ts                   API pública: ClientIdRepository, UpdateService, createUpdateHandlers

apps/desktop/src/main/platform/installer-launcher.ts
  spawnSilentInstaller        único lugar que lanza el instalador NSIS (flag /S)

apps/desktop/src/main/bootstrap/update-scheduler.ts
  createUpdateService         lee config de updates del entorno (o queda inerte si falta)
  startUpdateScheduler        arranca el ciclo periódico de checkNow()

apps/desktop/src/renderer/features/updates/
  index.ts                    API pública: UpdateBanner
  hooks/                        useUpdateStatusQuery (polling), useInstallUpdate
  components/                   UpdateBanner (único componente: no hay pantalla propia)
```

- `packages/updater-client` — `checkForUpdate`, `signCheckRequest`,
  `verifyManifestSignature`, `verifyArtifactSha512` (ver su propio `docs/00-overview/repo-map.md`).
- `packages/ipc-contract` — canales `updates.getStatus`, `updates.installNow`, ver
  [ipc-channels.md](ipc-channels.md).

Ver [data-model.md](data-model.md) para el estado interno y la tabla `settings`,
[decisions.md](decisions.md) para decisiones locales que no ameritaron ampliar el ADR,
[ui-flows.md](ui-flows.md) para los recorridos de usuario. El diseño completo (por qué
un cliente propio en vez de `electron-updater`, el comportamiento de silencio ante
errores, la verificación Ed25519+SHA512, el modo mantenimiento indistinguible) está en
[ADR-0003](../../adr/0003-abandonar-electron-updater.md); el diseño del Worker que
consume este cliente está en [ADR-0005](../../adr/0005-update-worker-en-cloudflare.md).

## Publicar una release (`.github/workflows/release-desktop.yml`)

El único camino para publicar una release firmada — nunca desde un portátil, ADR-0005
punto 5. Un tag `v*` dispara: `pnpm check:all` (mismo gate que cualquier PR) → empaquetar
con `electron-builder.yml` (NSIS, `differentialPackage: true`, sin firma de código) →
`tools/scripts/sign-release-manifest.mjs` calcula sha512/size y firma el manifest con
Ed25519 (`node:crypto`, la clave vive solo en `secrets.YCORE_SIGNING_KEY_BASE64`) →
sube instalador + `.blockmap` + manifest a R2 → `ycore release` (`tools/cli`) registra
la release en el Worker con rollout inicial 10%.

## Estado

**Completo para el ciclo principal**: comprobación periódica, descarga completa,
verificación Ed25519+SHA512, instalación silenciosa a demanda del usuario, IPC, el
banner del renderer (con modal de kill-switch), y el pipeline de publicación completo.
163 tests en `apps/desktop` (sumados a los de `packages/updater-client`), con
servidores HTTP reales y pares de claves Ed25519 generados en el propio test — sin
mocks de red ni de criptografía. `sign-release-manifest.mjs` verificado end-to-end
localmente: firma con una clave generada al vuelo y `crypto.subtle.verify` (el mismo
mecanismo que usa `verifyManifestSignature`) confirma la firma como válida.

**Sin verificar todavía**: el workflow completo contra R2/D1/KV reales (requiere
secretos de Cloudflare y GitHub que no existen en este entorno) — ver
`docs/05-operations/release-process.md` cuando exista.

**Fuera de esta iteración, documentado como deuda conocida** (ver
[decisions.md](decisions.md)): descarga diferencial por `.blockmap` (hoy siempre se
descarga el instalador completo), y persistencia del estado de descarga entre
reinicios (si el proceso muere a mitad, el siguiente arranque vuelve a comprobar desde
cero en vez de reanudar).
