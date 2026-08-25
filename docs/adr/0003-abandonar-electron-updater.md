# ADR-0003: Sustituir electron-updater por un cliente propio contra un endpoint controlado

- **Estado**: Aceptado
- **Fecha**: 2026-08-03
- **Decide**: @yummancito
- **Afecta a**: `packages/updater-client`, `services/update-worker`, `apps/desktop/src/main/features/updates`

## Contexto

Y-CORE v1 usaba `electron-updater` contra GitHub Releases públicas. Problemas concretos,
todos observados en producción:

- **Cero control sobre quién recibe qué.** El feed se derivaba de `build.publish`; no había
  forma de pausar las actualizaciones, hacer rollout progresivo ni retirar una versión rota.
- **Los binarios eran públicos.** Cualquiera descargaba el `.exe` sin pasar por la app.
- El retry de la librería fallaba, hasta el punto de que el v1 acabó con un **fallback
  escrito a mano con `https.get` crudo** (`app:manualDownloadUpdate`), siguiendo redirects
  301/302 manualmente, en paralelo al mecanismo oficial. Dos caminos de actualización
  conviviendo, con canales IPC inconsistentes entre ellos (`update:status` vs `update-progress`).
- `compression: "store"` + `differentialPackage: false` → **~400 MB por actualización completa**.
- Sin firma de código, con bloqueos recurrentes de Windows Defender.

La necesidad que dispara este ADR: poder poner las actualizaciones en **modo mantenimiento**
de forma silenciosa, algo que `electron-updater` no contempla.

## Decisión

Se escribe `packages/updater-client` propio (~600 líneas) que habla con un endpoint
controlado (`services/update-worker`, ver ADR-0004). Se **conserva** el formato de
instalador NSIS de electron-builder y su `.blockmap` para las descargas diferenciales,
pero **quien decide y descarga es código nuestro**.

El cliente:
- Consulta `GET /v1/check` y acepta solo tres respuestas: `up-to-date`, `update-available`,
  `blocked`.
- **Ante cualquier error de red, timeout o respuesta que no valide contra el schema Zod,
  se comporta como `up-to-date` en silencio.** El usuario nunca ve un error de actualización.
- Descarga diferencial vía blockmap + Range requests; si falla, cae a descarga completa.
- Verifica **firma Ed25519 del manifest + SHA512 del binario** antes de ejecutar nada.
- Nunca interrumpe una descarga de juego en curso.

En **modo mantenimiento** el Worker responde exactamente `up-to-date` a todo el mundo. El
cliente no puede distinguirlo de estar al día: **no existe un estado "en mantenimiento" en
el cliente**. Esa indistinguibilidad es la clave del diseño — nada que mostrar, nada que
fallar. Al desactivarlo, los clientes vuelven a recibir updates en la siguiente comprobación.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Seguir con electron-updater + un flag propio | El flag no evita que la librería haga su propia lógica de descarga y notificación; ya sabemos que su retry falla y que hubo que puentearla |
| electron-updater con feed URL propio | Da control del feed pero no del comportamiento del cliente: ni silencio ante errores, ni rollout determinista, ni URLs firmadas de vida corta |
| Squirrel.Windows | Menos control aún y peor encaje con NSIS/perMachine |
| Actualización manual (el usuario descarga de la web) | Fricción alta y fragmentación de versiones; el v1 ya sufría usuarios anclados en versiones viejas |

## Consecuencias

- **Positivas**: modo mantenimiento silencioso; rollout por porcentaje y kill-switch de
  versión; binarios privados servidos con URLs firmadas; updates diferenciales de ~15 MB en
  vez de 400 MB; un solo camino de actualización en el código.
- **Negativas / lo que aceptamos pagar**: ~600 líneas propias que hay que mantener y testear,
  incluidas las partes delicadas (reanudación, verificación de integridad, instalación
  silenciosa); perdemos las correcciones que la comunidad aporta a electron-updater.
- **Revertir**: volver a electron-updater implicaría renunciar al modo mantenimiento y al
  rollout, que son el motivo de existir de este ADR. Exigiría un ADR que lo reemplace.

## Cómo se verifica que se cumple

```
pnpm lint   # regla que prohíbe importar 'electron-updater' en todo el repo
pnpm test   # updater-client: respuesta inválida / timeout / 500 → se trata como up-to-date en silencio
            # firma Ed25519 inválida o sha512 que no cuadra → se rechaza y no se ejecuta nada
```

Verificación end-to-end manual, con binarios reales, en `docs/05-operations/release-process.md`:
instalar X.Y.Z → publicar X.Y.Z+1 → la app se actualiza sola; `ycore maintenance on` → el
cliente deja de ver updates sin mostrar ningún error ni popup; `off` → vuelven.
