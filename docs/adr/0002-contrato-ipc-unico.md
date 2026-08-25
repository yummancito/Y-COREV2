# ADR-0002: Toda comunicación main↔renderer pasa por un contrato tipado único

- **Estado**: Aceptado
- **Fecha**: 2026-08-03
- **Decide**: @yummancito
- **Afecta a**: `packages/ipc-contract`, `apps/desktop/src/main/ipc`, `apps/desktop/src/preload`

## Contexto

En Y-CORE v1 la frontera main↔renderer se degradó hasta volverse el mayor foco de deuda
y el único agujero de seguridad real del producto:

- **167 `ipcMain.handle`** repartidos por `electron/modules/`, `electron/handlers/` y
  `electron/main.ts`. Nadie sabía qué canales existían sin hacer grep.
- Se empezó un "gateway" genérico (`gateway:call` + `ServiceRegistry`) que iba a unificarlo
  todo, pero **la migración nunca terminó**: convivían los dos mecanismos, y el barrel de
  servicios exportaba 14 de 31.
- `preload.ts` exponía **`invoke(channel, ...args)` genérico y sin allowlist**. Cualquier
  código en el renderer — incluido cualquier cosa inyectada en una webview o una dependencia
  comprometida — podía invocar **cualquier** canal del main, incluidos los que lanzaban
  procesos e inyectaban DLLs.
- Los payloads no se validaban de forma consistente; `ipc-contract.ts` (818 líneas) describía
  tipos que nada garantizaba en runtime.

## Decisión

Existe **exactamente un `ipcMain.handle`** en todo el repo, en
`apps/desktop/src/main/ipc/router.ts`, y todo canal se declara previamente en
`packages/ipc-contract` con schemas Zod de input y output.

En concreto:

1. `packages/ipc-contract` es un paquete independiente, sin dependencias de Electron ni de
   React, que declara cada canal con `input`/`output` en Zod, ambos con `.describe()`.
2. El router valida el input, ejecuta el handler, valida el output y devuelve
   `Result<T, AppError>`. **Nunca propaga un throw al renderer.**
3. El preload **genera** un método por canal desde el contrato
   (`window.ycore.library.launch({ appId })`). **No expone `invoke()` genérico.**
   Si un canal no está en el contrato, la función no existe: la allowlist es estructural,
   no una lista que mantener a mano.
4. Los eventos main→renderer siguen el mismo patrón y el mismo allowlist.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Terminar el gateway del v1 | Arrastra el `invoke()` genérico y un registry a medias; el problema no era la implementación sino que no había una única fuente de verdad |
| tRPC sobre IPC | Añade una capa de runtime y conceptos (routers, procedures, transformers) para un problema que se resuelve con un mapa y Zod. Peso injustificado |
| Solo tipos TS compartidos, sin validación runtime | Es lo que tenía el v1: los tipos mienten en cuanto el payload cruza el puente. Un renderer comprometido manda lo que quiera |
| Un `ipcMain.handle` por feature | Sigue sin dar allowlist ni validación uniforme, y vuelve a dispersar la frontera |

## Consecuencias

- **Positivas**: la superficie de ataque del renderer queda reducida a los canales
  declarados; añadir un canal obliga a documentarlo (`.describe()`); el contrato es
  navegable y `ipc-channels.md` se genera desde él; un canal huérfano rompe el build.
- **Negativas / lo que aceptamos pagar**: añadir un canal cuesta más pasos que escribir un
  `ipcMain.handle` suelto; hay que mantener un generador de preload; el contrato es un
  punto de acoplamiento que todos tocan.
- **Revertir**: implicaría reintroducir handlers dispersos. No se contempla; si alguna vez
  se hiciera, exigiría un ADR nuevo que reemplace a este.

## Cómo se verifica que se cumple

```
pnpm lint            # regla no-raw-ipc: prohíbe ipcMain.*/ipcRenderer.* fuera de ipc/ y preload/
pnpm check:contract  # correspondencia bidireccional contrato ↔ handlers registrados
pnpm test            # test de arranque: contextIsolation on, nodeIntegration off, sandbox on
```

Además, el hook `tools/scripts/check-file-rules.mjs` (reglas R3, R3b y R4) bloquea al
escribir cualquier archivo que rompa esto, antes incluso de llegar a lint.
