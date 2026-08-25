import { describe, expect, it } from 'vitest';
import { TokenBucket } from './token-bucket.js';

describe('TokenBucket', () => {
  it('sin límite configurado, concede siempre todo lo pedido', () => {
    const bucket = new TokenBucket();

    expect(bucket.take(10_000_000, 0)).toBe(10_000_000);
    expect(bucket.take(10_000_000, 1)).toBe(10_000_000);
  });

  it('con límite, concede hasta el cupo inicial y luego frena', () => {
    const bucket = new TokenBucket(1000, 0);

    expect(bucket.take(1000, 0)).toBe(1000);
    expect(bucket.take(500, 0)).toBe(0);
  });

  it('recarga el cupo proporcionalmente al tiempo transcurrido', () => {
    const bucket = new TokenBucket(1000, 0);
    bucket.take(1000, 0);

    const granted = bucket.take(1000, 500);

    expect(granted).toBe(500);
  });

  it('nunca concede más que el ritmo máximo configurado, aunque pase mucho tiempo', () => {
    const bucket = new TokenBucket(1000, 0);

    const granted = bucket.take(10_000, 60_000);

    expect(granted).toBe(1000);
  });

  it('nunca concede más de lo pedido, aunque haya cupo de sobra', () => {
    const bucket = new TokenBucket(1000, 0);

    const granted = bucket.take(10, 1000);

    expect(granted).toBe(10);
  });

  it('msUntilNextToken es 0 sin límite configurado', () => {
    const bucket = new TokenBucket();
    expect(bucket.msUntilNextToken(0)).toBe(0);
  });

  it('msUntilNextToken es 0 mientras haya cupo disponible', () => {
    const bucket = new TokenBucket(1000, 0);
    expect(bucket.msUntilNextToken(0)).toBe(0);
  });

  it('msUntilNextToken indica cuánto esperar cuando el cupo se agotó', () => {
    const bucket = new TokenBucket(1000, 0);
    bucket.take(1000, 0);

    const waitMs = bucket.msUntilNextToken(0);

    expect(waitMs).toBeGreaterThan(0);
    expect(waitMs).toBeLessThanOrEqual(1000);
  });
});
