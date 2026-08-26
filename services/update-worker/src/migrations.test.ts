import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { applyMigrations } from './test-migrations.js';

describe('migraciones D1', () => {
  it('aplican desde cero y producen las tres tablas de C.3', async () => {
    await applyMigrations();

    const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
    const names = tables.results.map((row) => (row as { name: string }).name);

    expect(names).toContain('releases');
    expect(names).toContain('maintenance_log');
    expect(names).toContain('check_stats');
  });

  it('la tabla releases queda vacía tras migrar', async () => {
    await applyMigrations();

    const row = await env.DB.prepare('SELECT COUNT(*) as count FROM releases').first();
    expect((row as { count: number }).count).toBe(0);
  });
});
