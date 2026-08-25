/**
 * `createLogger` — el único logger de Y-CORE, usado en main, preload y renderer.
 *
 * Sirve para que main/renderer/plugins registren eventos con el mismo formato,
 * en vez de que cada feature invente su propio `console.log`. En el v1 no había
 * convención: unos usaban `console.log`, otros `electron-log`, y depurar un bug
 * de producción significaba adivinar en qué archivo estaba el rastro.
 *
 * Salida:
 *  - En desarrollo (`NODE_ENV !== 'production'`): línea legible con color por nivel.
 *  - En producción: una línea JSON por evento, apta para parsear en soporte.
 *
 * Nunca lanza: un fallo al loguear (p. ej. `context` no serializable) se degrada
 * a un log de nivel `warn` sobre el propio fallo, nunca interrumpe al llamador.
 *
 * @example
 * ```ts
 * const log = createLogger('main:library');
 * log.info('juego lanzado', { appId: 730 });
 * log.error('fallo al leer el manifest', { appId: 730, detail: err.message });
 * ```
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Contexto estructurado adjunto a un evento de log. Sin PII ni secretos. */
export type LogContext = Readonly<Record<string, unknown>>;

/** API pública que devuelve {@link createLogger}. */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Crea un logger hijo que añade `childScope` al scope actual (p. ej. "main:library:launch"). */
  child(childScope: string): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: '\x1b[90m', // gris
  info: '\x1b[36m', // cian
  warn: '\x1b[33m', // amarillo
  error: '\x1b[31m', // rojo
};
const COLOR_RESET = '\x1b[0m';

/** Convierte `context` a texto sin lanzar, incluso si tiene ciclos o BigInt. */
function safeStringify(context: LogContext): string {
  try {
    return JSON.stringify(context);
  } catch (error) {
    return JSON.stringify({ loggerSerializationError: String(error) });
  }
}

/**
 * Sirve para decidir si un evento se emite según el umbral configurado.
 * Para qué: evita construir/serializar el mensaje si de todos modos se va a
 * descartar (p. ej. `debug` en producción).
 */
function isAboveThreshold(level: LogLevel, threshold: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[threshold];
}

function formatDev(scope: string, level: LogLevel, message: string, context?: LogContext): string {
  const color = LEVEL_COLOR[level];
  const contextPart = context && Object.keys(context).length > 0 ? ` ${safeStringify(context)}` : '';
  return `${color}[${level.toUpperCase()}]${COLOR_RESET} ${scope} — ${message}${contextPart}`;
}

function formatProd(scope: string, level: LogLevel, message: string, context?: LogContext): string {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(context !== undefined && { context }),
  });
}

/**
 * Construye un {@link Logger} con el scope dado.
 *
 * @param scope - Identifica de dónde viene el log, p. ej. `"main:library"` o
 *   `"renderer:downloads"`. Convención: `<proceso>:<feature>[:<subsistema>]`.
 * @param options.threshold - Nivel mínimo que se emite. Por defecto `debug` en
 *   desarrollo y `info` en producción.
 * @returns Un logger que nunca lanza, incluso si `context` no es serializable.
 */
export function createLogger(
  scope: string,
  options: { threshold?: LogLevel } = {},
): Logger {
  const isProd = process.env['NODE_ENV'] === 'production';
  const threshold = options.threshold ?? (isProd ? 'info' : 'debug');

  function emit(level: LogLevel, message: string, context?: LogContext): void {
    if (!isAboveThreshold(level, threshold)) return;

    const line = isProd
      ? formatProd(scope, level, message, context)
      : formatDev(scope, level, message, context);

    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    sink(line);
  }

  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
    child: (childScope) => createLogger(`${scope}:${childScope}`, options),
  };
}
