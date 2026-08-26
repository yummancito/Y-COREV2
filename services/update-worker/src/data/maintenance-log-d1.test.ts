import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { isOk } from '@ycore/result';
import { insertMaintenanceLogEntry } from './maintenance-log-d1.js';
import { applyMigrations } from '../test-migrations.js';

describe('maintenance-log-d1', () => {
  beforeEach(async () => {
    await applyMigrations();
    // El schema de esta versión de vitest-pool-workers no aísla el storage
    // entre tests del mismo archivo (ver vitest.config.ts): se limpia a mano.
    await env.DB.prepare('DELETE FROM maintenance_log').run();
  });

  it('inserta una fila de auditoría con actor, nota y timestamp', async () => {
    const result = await insertMaintenanceLogEntry(env.DB, true, 'yummancito', 'migrando R2', '2026-01-01T00:00:00.000Z');

    expect(isOk(result)).toBe(true);
    const row = await env.DB.prepare('SELECT * FROM maintenance_log').first();
    expect(row).toMatchObject({ enabled: 1, actor: 'yummancito', note: 'migrando R2', at: '2026-01-01T00:00:00.000Z' });
  });

  it('cada llamada añade una fila nueva, no sobrescribe', async () => {
    await insertMaintenanceLogEntry(env.DB, true, 'a', 'on', '2026-01-01T00:00:00.000Z');
    await insertMaintenanceLogEntry(env.DB, false, 'a', 'off', '2026-01-02T00:00:00.000Z');

    const { results } = await env.DB.prepare('SELECT * FROM maintenance_log ORDER BY id').all();
    expect(results).toHaveLength(2);
  });
});
