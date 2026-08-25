/**
 * `AppError` — el único tipo de error que cruza una frontera en Y-CORE.
 *
 * No es una subclase de `Error`: es un objeto plano, porque tiene que sobrevivir
 * a la serialización del puente IPC (un `Error` real llega al renderer sin stack,
 * sin propiedades propias y sin nada útil).
 *
 * Cada error lleva una **clave i18n**, no un mensaje. El texto que ve el usuario
 * se resuelve en el renderer, en su idioma. En el v1 los mensajes viajaban en
 * inglés hardcodeado desde el main y no había forma de traducirlos.
 */

/** Códigos de error conocidos. Ampliar aquí obliga a traducir la clave en `packages/i18n`. */
export type AppErrorCode =
  /** El payload no valida contra el schema Zod del canal. */
  | 'ipc.invalid-input'
  /** El handler devolvió algo que no encaja con el output declarado. */
  | 'ipc.invalid-output'
  /** El canal invocado no existe en el registry. */
  | 'ipc.unknown-channel'
  /** El handler lanzó una excepción no controlada (bug). */
  | 'ipc.handler-crashed'
  /** Fallo de red recuperable. */
  | 'net.unreachable'
  /** El recurso pedido no existe. */
  | 'not-found'
  /** La operación requiere permisos que no tenemos. */
  | 'permission-denied'
  /** Fallo de E/S en disco. */
  | 'io.failed'
  /** Error sin clasificar: siempre es un bug que hay que clasificar. */
  | 'unknown';

/**
 * Error serializable que atraviesa fronteras.
 *
 * @example
 * ```ts
 * return err(appError('not-found', { retriable: false, context: { appId } }));
 * ```
 */
export interface AppError {
  /** Clave estable del error; también es la clave de traducción. */
  readonly code: AppErrorCode;
  /** Si reintentar la misma operación puede funcionar (fallo de red sí, input inválido no). */
  readonly retriable: boolean;
  /** Datos para interpolar en el mensaje traducido y para los logs. Sin PII ni secretos. */
  readonly context?: Readonly<Record<string, unknown>>;
  /** Detalle técnico para el log. **Nunca se muestra al usuario.** */
  readonly detail?: string;
}

/** Códigos que por naturaleza admiten reintento. */
const RETRIABLE_BY_DEFAULT: ReadonlySet<AppErrorCode> = new Set<AppErrorCode>([
  'net.unreachable',
  'io.failed',
]);

/**
 * Construye un {@link AppError}. `retriable` se deduce del código salvo que lo fuerces.
 *
 * @example
 * ```ts
 * appError('net.unreachable');                          // retriable: true
 * appError('not-found', { context: { appId: 730 } });   // retriable: false
 * ```
 */
export function appError(
  code: AppErrorCode,
  options: {
    retriable?: boolean;
    context?: Readonly<Record<string, unknown>>;
    detail?: string;
  } = {},
): AppError {
  return {
    code,
    retriable: options.retriable ?? RETRIABLE_BY_DEFAULT.has(code),
    ...(options.context !== undefined && { context: options.context }),
    ...(options.detail !== undefined && { detail: options.detail }),
  };
}

/**
 * Convierte cualquier valor capturado en un `catch` a un {@link AppError}.
 *
 * Úsalo solo en la frontera con código de terceros que lanza. El resultado siempre
 * es `unknown` como código: si ves muchos de estos en los logs, es que falta
 * clasificar esos fallos con un código propio.
 */
export function fromUnknown(error: unknown): AppError {
  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

  return appError('unknown', { retriable: false, detail });
}
