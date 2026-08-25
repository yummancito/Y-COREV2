/**
 * `Result<T, E>` — el tipo de retorno de todo lo que cruza una frontera.
 *
 * En Y-CORE v1 los errores viajaban como excepciones a través del puente IPC, donde
 * pierden el stack y llegan al renderer como un `Error` genérico sin código ni
 * traducción. Aquí un fallo esperable es un **valor**, no una excepción.
 *
 * Regla: prohibido `throw` cruzando IPC, plugins o servicios. Devuelve `Result`.
 * Las excepciones quedan reservadas para bugs de programación (invariantes rotas).
 *
 * @example
 * ```ts
 * function launch(appId: number): Result<{ pid: number }, AppError> {
 *   if (!isInstalled(appId)) return err(appError('game.not-installed', { appId }));
 *   return ok({ pid: spawnGame(appId) });
 * }
 *
 * const res = launch(730);
 * if (isOk(res)) console.log(res.value.pid);
 * else console.error(res.error.code);
 * ```
 */
export type Result<T, E> = Ok<T> | Err<E>;

/** Rama de éxito de un {@link Result}. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** Rama de fallo de un {@link Result}. */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/** Construye un {@link Result} exitoso. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Construye un {@link Result} fallido. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Type guard: estrecha un {@link Result} a su rama de éxito. */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/** Type guard: estrecha un {@link Result} a su rama de fallo. */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * Transforma el valor de un `Result` exitoso, dejando el fallo intacto.
 *
 * @example
 * ```ts
 * const size = map(readFile(path), (content) => content.length);
 * ```
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return isOk(result) ? ok(fn(result.value)) : result;
}

/**
 * Encadena operaciones que a su vez devuelven `Result`, cortocircuitando en el
 * primer fallo. Evita las escaleras de `if (isErr(...)) return ...`.
 *
 * @example
 * ```ts
 * const pid = flatMap(findGame(appId), (game) => launchGame(game));
 * ```
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return isOk(result) ? fn(result.value) : result;
}

/** Transforma el error de un `Result` fallido, dejando el éxito intacto. */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return isErr(result) ? err(fn(result.error)) : result;
}

/** Extrae el valor, o devuelve `fallback` si el `Result` es un fallo. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return isOk(result) ? result.value : fallback;
}

/**
 * Envuelve una función que puede lanzar, convirtiendo la excepción en un `Err`.
 *
 * Úsalo en la frontera con librerías de terceros que lanzan. **No** lo uses para
 * seguir lanzando por dentro: la idea es que la excepción muera aquí.
 *
 * @example
 * ```ts
 * const parsed = fromThrowable(() => JSON.parse(raw), (e) => appError('parse.failed', { e }));
 * ```
 */
export function fromThrowable<T, E>(fn: () => T, onThrow: (error: unknown) => E): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    return err(onThrow(error));
  }
}

/** Igual que {@link fromThrowable} pero para promesas. */
export async function fromPromise<T, E>(
  promise: Promise<T>,
  onReject: (error: unknown) => E,
): Promise<Result<T, E>> {
  try {
    return ok(await promise);
  } catch (error) {
    return err(onReject(error));
  }
}
