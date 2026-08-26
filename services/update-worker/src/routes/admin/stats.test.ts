import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleAdminStats } from './stats.js';
import { applyMigrations } from '../../test-migrations.js';
import { recordCheckOutcome } from '../../data/stats-d1.js';
import type { WorkerEnv } from '../../env.js';

const ADMIN_TOKEN = 'admin-token';

function testEnv(): WorkerEnv {
  return { ...env, YCORE_CLIENT_SECRET: 'client-secret', YCORE_ADMIN_TOKEN: ADMIN_TOKEN };
}

describe('handleAdminStats', () => {
  beforeEach(async () => {
    await applyMigrations();
    await env.DB.prepare('DELETE FROM check_stats').run();
  });

  it('sin bearer responde 401', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/stats');

    const response = await handleAdminStats(request, testEnv());

    expect(response.status).toBe(401);
  });

  it('con bearer bueno devuelve las stats recientes', async () => {
    await recordCheckOutcome(env.DB, new Date().toISOString().slice(0, 10), '5.1.0', 'stable', 'update-available');

    const request = new Request('https://updates.y-core.app/v1/admin/stats', {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    const response = await handleAdminStats(request, testEnv());
    const body: { stats: unknown[] } = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats).toHaveLength(1);
  });
});
