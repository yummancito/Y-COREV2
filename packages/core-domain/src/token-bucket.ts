/**
 * `TokenBucket` — limita el ancho de banda de una descarga a un ritmo máximo de bytes/segundo.
 *
 * Sirve para que el consumidor del stream de descarga pida permiso para N
 * bytes antes de escribirlos, en vez de esparcir `setTimeout` por el pipe
 * (el ADR-0004 lo señala explícitamente como lo que hay que evitar). Puro y
 * testeable con reloj inyectado: no arranca ningún timer real.
 */

/** Un `TokenBucket` sin límite (`Number.POSITIVE_INFINITY` bytes/s) no frena nada. */
const UNLIMITED = Number.POSITIVE_INFINITY;

export class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;

  /**
   * @param bytesPerSecond - Ritmo máximo sostenido. Usa {@link UNLIMITED}
   *   (o no pases límite) para no frenar nada.
   * @param now - Marca de tiempo inicial en ms (inyectada).
   */
  constructor(
    private readonly bytesPerSecond: number = UNLIMITED,
    now = 0,
  ) {
    this.tokens = bytesPerSecond;
    this.lastRefillAt = now;
  }

  /**
   * Calcula cuántos de los `requestedBytes` se pueden consumir ahora mismo
   * sin superar el ritmo configurado, y los descuenta del cupo disponible.
   *
   * @param requestedBytes - Cuántos bytes quiere escribir el llamador.
   * @param now - Marca de tiempo actual en ms (inyectada).
   * @returns Cuántos bytes de `requestedBytes` están permitidos ahora
   *   (siempre ≥ 0, nunca más que `requestedBytes`). Si es menor que lo
   *   pedido, el llamador debe esperar antes de pedir el resto.
   */
  take(requestedBytes: number, now: number): number {
    if (this.bytesPerSecond === UNLIMITED) return requestedBytes;

    const elapsedSeconds = Math.max(0, now - this.lastRefillAt) / 1000;
    this.tokens = Math.min(this.bytesPerSecond, this.tokens + elapsedSeconds * this.bytesPerSecond);
    this.lastRefillAt = now;

    const granted = Math.max(0, Math.min(requestedBytes, Math.floor(this.tokens)));
    this.tokens -= granted;
    return granted;
  }

  /**
   * Cuántos milisegundos hay que esperar hasta que haya al menos un byte de
   * cupo disponible. Sirve para que el llamador sepa cuánto dormir tras un
   * {@link take} que devolvió 0.
   */
  msUntilNextToken(now: number): number {
    if (this.bytesPerSecond === UNLIMITED) return 0;
    const elapsedSeconds = Math.max(0, now - this.lastRefillAt) / 1000;
    const projectedTokens = Math.min(this.bytesPerSecond, this.tokens + elapsedSeconds * this.bytesPerSecond);
    if (projectedTokens >= 1) return 0;
    const secondsNeeded = (1 - projectedTokens) / this.bytesPerSecond;
    return Math.ceil(secondsNeeded * 1000);
  }
}
