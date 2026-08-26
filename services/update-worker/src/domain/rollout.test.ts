import { describe, expect, it } from 'vitest';
import { computeRolloutBucket, isInRollout } from './rollout.js';

describe('computeRolloutBucket', () => {
  it('es determinista: el mismo par (clientId, version) da siempre el mismo bucket', async () => {
    const first = await computeRolloutBucket('client-1', '5.1.0');
    const second = await computeRolloutBucket('client-1', '5.1.0');
    expect(first).toBe(second);
  });

  it('produce un bucket en el rango [0, 100)', async () => {
    const bucket = await computeRolloutBucket('client-1', '5.1.0');
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
  });

  it('distintos clientId producen (normalmente) distintos buckets', async () => {
    const buckets = await Promise.all(
      Array.from({ length: 20 }, (_, i) => computeRolloutBucket(`client-${i}`, '5.1.0')),
    );
    expect(new Set(buckets).size).toBeGreaterThan(1);
  });
});

describe('isInRollout', () => {
  it('rollout 0 no incluye a nadie', async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => isInRollout(`client-${i}`, '5.1.0', 0)),
    );
    expect(results.every((r) => r === false)).toBe(true);
  });

  it('rollout 100 incluye a todos', async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => isInRollout(`client-${i}`, '5.1.0', 100)),
    );
    expect(results.every((r) => r === true)).toBe(true);
  });

  it('subir el rollout nunca saca a un cliente que ya estaba dentro (subconjunto)', async () => {
    const clientIds = Array.from({ length: 1000 }, (_, i) => `client-${i}`);
    const in10 = await Promise.all(clientIds.map((id) => isInRollout(id, '5.1.0', 10)));
    const in50 = await Promise.all(clientIds.map((id) => isInRollout(id, '5.1.0', 50)));

    for (let i = 0; i < clientIds.length; i += 1) {
      if (in10[i]) expect(in50[i]).toBe(true);
    }
  });
});
