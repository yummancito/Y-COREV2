# Manejo de errores

`Result<T, AppError>` (`packages/result`) es el único vocabulario de error que cruza
una frontera en Y-CORE. **Prohibido `throw` cruzando fronteras** (IPC, plugin,
servicio) — regla inviolable de `.claude/CLAUDE.md`.

## `Result<T, AppError>`

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

ok(value)      // construye la rama de éxito
err(error)     // construye la rama de error
isOk(result)   // narrowing
isErr(result)  // narrowing
map(result, fn) // transforma value si ok, pasa el error si no
```

Se usa en cada capa: un repositorio devuelve `Result` en vez de lanzar si una fila no
existe; un servicio propaga o transforma ese `Result`; un handler IPC lo traduce a la
forma exacta del contrato.

## `AppError`

```ts
interface AppError {
  code: AppErrorCode;       // clave estable, también clave de traducción i18n
  retriable: boolean;       // ¿reintentar la misma operación puede funcionar?
  context?: Record<string, unknown>; // datos para interpolar, sin PII ni secretos
  detail?: string;          // detalle técnico para el log — NUNCA se muestra al usuario
}
```

No es una subclase de `Error`: es un objeto plano. Un `Error` real que cruza el puente
IPC llega al renderer sin stack, sin propiedades propias y sin nada útil — por eso
`AppError` es serializable desde el diseño, no una conversión de último momento.

Cada error lleva una **clave**, no un mensaje ya traducido. El texto que ve el usuario
se resuelve en el renderer, en su idioma — en el v1 los mensajes viajaban en inglés
hardcodeado desde el main y no había forma de traducirlos.

### `appError(code, options)`

Constructor que deduce `retriable` del código salvo que se fuerce explícitamente.
`net.unreachable` e `io.failed` son `retriable: true` por defecto; el resto,
`false`.

### `fromUnknown(error)`

Único lugar donde se admite convertir un `catch` genérico: envuelve cualquier valor
capturado en un `AppError` con código `unknown` y el detalle técnico en `detail`. Solo
se usa en la frontera con código de terceros que sí lanza (una librería, `fetch`,
`fs`) — nunca como sustituto de clasificar el error con su propio código.

## Códigos conocidos hoy (`AppErrorCode`)

| Código | Cuándo |
|---|---|
| `ipc.invalid-input` | El payload no valida contra el schema Zod del canal |
| `ipc.invalid-output` | El handler devolvió algo que no encaja con el output declarado |
| `ipc.unknown-channel` | El canal invocado no existe en el registry |
| `ipc.handler-crashed` | El handler lanzó una excepción no controlada (bug) |
| `net.unreachable` | Fallo de red recuperable |
| `not-found` | El recurso pedido no existe |
| `permission-denied` | La operación requiere permisos que no tenemos |
| `io.failed` | Fallo de E/S en disco |
| `download.invalid-transition` | Transición de `DownloadState` no permitida |
| `download.integrity-mismatch` | El hash del archivo descargado no coincide con el esperado |
| `download.duplicate` | Ya existe una descarga activa para el mismo `appId` |
| `download.zip-slip` | El ZIP a extraer tiene una entrada que se sale de `install_path` |
| `unknown` | Sin clasificar — siempre indica que falta un código propio |

Ampliar esta lista obliga a traducir la clave nueva en `packages/i18n` cuando ese
paquete exista (todavía reservado, sin código — ver
[`../00-overview/repo-map.md`](../00-overview/repo-map.md)).

## Cómo se ve en cada frontera

- **Repositorio → servicio**: `Result` de vuelta, nunca `throw`.
- **Servicio → handler IPC**: el handler traduce el `Result` de dominio a la forma
  exacta del contrato, sin cambiar `AppError`.
- **Handler IPC → router**: el router (`main/ipc/router.ts`) valida el output
  declarado y, si el handler lanzó de verdad (bug), lo captura y lo convierte en
  `ipc.handler-crashed` — nunca deja escapar la excepción hacia el renderer.
- **`services/update-worker`**: hacia el cliente público, códigos de estado HTTP +
  body mínimo — nunca un `Result` serializado (ver ADR-0005, punto 4). Hacia dentro
  del propio Worker (`data/*.ts` ↔ `domain/*.ts` ↔ `routes/*.ts`), el mismo
  `Result<T, AppError>` de `@ycore/result`, sin dependencias de Node.
- **`packages/updater-client`**: `checkForUpdate` es la única excepción deliberada —
  nunca devuelve un error, cualquier fallo de red/timeout/validación se convierte en
  `up-to-date` en silencio (ADR-0003). El resto de sus funciones
  (`verifyManifestSignature`, `verifyArtifactSha512`) sí usan `Result`.
