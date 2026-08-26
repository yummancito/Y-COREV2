import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { isOk } from '@ycore/result';
import { readRecentStats, recordCheckOutcome } from './stats-d1.js';
import { applyMigrations } from '../test-migrations.js';

describe('stats-d1', () => {
  beforeEach(async () => {
    await applyMigrations();
    // El schema de esta versión de vitest-pool-workers no aísla el storage
    // entre tests del mismo archivo (ver vitest.config.ts): se limpia a mano.
    await env.DB.prepare('DELETE FROM check_stats').run();
  });

  it('recordCheckOutcome inserta una fila nueva con count 1', async () => {
    await recordCheckOutcome(env.DB, '2026-01-01', '5.1.0', 'stable', 'update-available');

    const result = await readRecentStats(env.DB, '2026-01-01');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([{ day: '2026-01-01', version: '5.1.0', channel: 'stable', outcome: 'update-available', count: 1 }]);
    }
  });

  it('recordCheckOutcome repetido suma al mismo agregado en vez de duplicar la fila', async () => {
    await recordCheckOutcome(env.DB, '2026-01-01', '5.1.0', 'stable', 'up-to-date');
    await recordCheckOutcome(env.DB, '2026-01-01', '5.1.0', 'stable', 'up-to-date');
    await recordCheckOutcome(env.DB, '2026-01-01', '5.1.0', 'stable', 'up-to-date');

    const result = await readRecentStats(env.DB, '2026-01-01');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.count).toBe(3);
    }
  });

  it('readRecentStats no incluye días anteriores al filtro', async () => {
    await recordCheckOutcome(env.DB, '2026-01-01', '5.0.0', 'stable', 'up-to-date');
    await recordCheckOutcome(env.DB, '2026-01-05', '5.1.0', 'stable', 'update-available');

    const result = await readRecentStats(env.DB, '2026-01-03');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.day).toBe('2026-01-05');
    }
  });
});
