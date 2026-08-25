/**
 * `ProgressThrottle` — limita las emisiones de progreso de una descarga a ~4/s sin perder la última.
 *
 * Sirve para que los eventos de progreso IPC no saturen el renderer (el
 * roadmap pide 4/s, no los ~60/s de una lectura de stream cruda) sin que el
 * último byte antes de una transición de estado se pierda — el error típico
 * de un `throttle` con `trailing` basado en timer es que si el proceso
 * termina antes de que el timer dispare, esa última muestra nunca se emite.
 *
 * Puro y testeable sin timers reales: el reloj (`now`) entra por parámetro en
 * vez de leer `Date.now()` internamente.
 */

const MIN_INTERVAL_MS = 250;

/** Una muestra de progreso de una descarga en curso. */
export interface ProgressSample {
  readonly bytesDownloaded: number;
  readonly bytesTotal: number | null;
}

/**
 * Decide qué muestras de progreso emitir, agrupando las que llegan más
 * seguido que `MIN_INTERVAL_MS` (250 ms, → 4/s) y garantizando que la más
 * reciente se recupera con {@link ProgressThrottle.flush}.
 */
export class ProgressThrottle {
  private lastEmittedAt: number | null = null;
  private pending: ProgressSample | null = null;

  /**
   * Registra una muestra nueva.
   *
   * @param sample - El progreso actual.
   * @param now - Marca de tiempo en ms (inyectada; normalmente `Date.now()`).
   * @returns La muestra a emitir ahora, o `null` si toca esperar (queda
   *   guardada como pendiente y se recupera con {@link flush}).
   */
  sample(sample: ProgressSample, now: number): ProgressSample | null {
    if (this.lastEmittedAt === null || now - this.lastEmittedAt >= MIN_INTERVAL_MS) {
      this.lastEmittedAt = now;
      this.pending = null;
      return sample;
    }
    this.pending = sample;
    return null;
  }

  /**
   * Vacía la muestra pendiente, si la hay. Debe llamarse siempre antes de
   * toda transición de estado y al completar la descarga, para que el
   * progreso final no se pierda por caer dentro de la ventana de throttle.
   *
   * @returns La última muestra pendiente, o `null` si no había ninguna
   *   (porque ya se emitió, o porque no llegó ninguna muestra todavía).
   */
  flush(): ProgressSample | null {
    const sample = this.pending;
    this.pending = null;
    return sample;
  }
}
