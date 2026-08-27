# API de plugins — diseño planeado (Fase 7, no implementado todavía)

**Estado: `plugins/` está vacío en el repo. Nada de lo descrito aquí existe como
código todavía** — esto es el diseño que fija el roadmap (Fase 7) para cuando esa
fase empiece, escrito de antemano para que la Fase 8 (`drm-tools`) no tenga que
inventar la interfaz sobre la marcha. Si estás implementando la Fase 7, este
documento es el punto de partida — actualízalo con la realidad del código a medida
que avances, y si algo cambia respecto a lo aquí escrito, ese cambio es candidato a
ADR (cambia una frontera del monorepo).

## Por qué un plugin no es una feature más

Ya existe `packages/eslint-config` con un tipo `plugin` en la matriz de boundaries
(`plugins/*/**`, permitido importar `ipc-contract`, `core-domain`, `result`) — la
frontera está reservada aunque el código todavía no exista. La diferencia con una
feature de `apps/desktop/src/main/features/`: un plugin es código de terceros (o al
menos, tratado con la misma desconfianza que si lo fuera), así que necesita:

- **Aislamiento de proceso real**, no solo de módulo — un plugin que crashea no puede
  tumbar la app.
- **Permisos declarados explícitamente**, no acceso implícito a lo que el main tiene.
- **Verificación de firma** antes de cargarlo — mismo principio que la cadena de
  confianza de actualizaciones (ver `docs/06-security/signing.md`), aplicado a código
  que no es el propio binario de Y-CORE.

## Diseño planeado

### Manifest del plugin

Cada plugin declara, en un manifest propio (formato exacto a definir en la Fase 7,
probablemente JSON validado con Zod, mismo criterio que `packages/ipc-contract`):

- Identidad (`id`, versión).
- Permisos que pide — explícitos, no un catch-all.
- Los canales `plugin:<id>.<canal>` que expone, con el mismo tipo de contrato Zod
  input/output que usa `packages/ipc-contract` para el resto de la app.
- Ciclo de vida: qué hacer al activar, desactivar, descargar.

### Aislamiento: utility process, no el main

Un plugin corre en su propio **utility process** de Electron, no dentro del proceso
main. Esto es lo que garantiza el criterio de HECHO de la Fase 7: "un plugin que
crashea no tumba la app" — si el proceso del plugin muere, el main sigue vivo y puede
reportarlo, reintentarlo o desactivar el plugin, sin que el usuario pierda el resto
de la sesión.

La Fase 8 (`drm-tools`, un port de FFI vía `koffi`) es el primer caso real de este
patrón: si el FFI nativo revienta, muere el proceso utility, no la app — con
detección de protecciones y estrategias con fallback, DLLs verificadas por hash
desde R2 (misma idea que verificar el instalador con SHA-512, aplicada a binarios de
terceros).

### Namespaces de canal, mismo allowlist que el resto de la app

`plugin:<id>.<canal>` sigue el mismo modelo que `<feature>.<verbo>` del contrato IPC
principal (ADR-0002): allowlist estricta, sin `invoke()` genérico, validado con Zod.
Un plugin no gana acceso a los canales `library.*`/`downloads.*`/`updates.*` de la
app por estar cargado — solo a los que el cargador de plugins decide exponerle según
sus permisos declarados.

### Descubrimiento y validación de firma

El cargador (a implementar en la Fase 7) descubre plugins instalados, valida su firma
antes de cargarlos (evitando el mismo problema que resuelve la cadena de confianza de
actualizaciones: nadie debe poder distribuir un plugin troyanizado que se haga pasar
por legítimo), y solo entonces arranca su utility process con los permisos
declarados.

### Panel admin

Mencionado en el roadmap como parte de la Fase 7: un panel de administración del
propio update-worker, protegido tras Cloudflare Access (autenticación gestionada por
Cloudflare, sin backend propio de login) — separado de la CLI `ycore`
(`tools/cli`), que ya cubre las mismas operaciones desde terminal.

## Criterio de HECHO (roadmap, Fase 7)

- Un plugin de ejemplo (`hello-plugin`) se carga, registra un canal, se desactiva y
  se descarga limpiamente.
- Un plugin que crashea **no tumba la app**.

## Qué leer antes de empezar la Fase 7

- [`../01-architecture/overview.md`](../01-architecture/overview.md) y
  [`../01-architecture/boundaries.md`](../01-architecture/boundaries.md) — el patrón
  de frontera que un plugin debe respetar, ya declarado en `eslint-config`.
- [`../07-contributing/how-to-add-an-ipc-channel.md`](../07-contributing/how-to-add-an-ipc-channel.md)
  — el mismo procedimiento de contrato Zod que un canal `plugin:*` deberá seguir.
- ADR-0002 (contrato IPC único) — por qué el allowlist estricto importa tanto aquí
  como en el resto de la app.
