import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleAdminRollout } from './rollout.js';
import { applyMigrations } from '../../test-migrations.js';
import type { WorkerEnv } from '../../env.js';

const ADMIN_TOKEN = 'admin-token';
const CONFIG = {
  maintenance: { enabled: false, since: null, note: '' },
  channels: { stable: { latest: '5.1.0', rollout: 10, minSupported: '4.0.0' } },
  blocked: {},
  checkIntervalSeconds: 21600,
};

function testEnv(): WorkerEnv {
  return { ...env, YCORE_CLIENT_SECRET: 'client-secret', YCORE_ADMIN_TOKEN: ADMIN_TOKEN };
}

describe('handleAdminRollout', () => {
  beforeEach(async () => {
    await applyMigrations();
    await env.DB.prepare('DELETE FROM admin_actions_log').run();
    await env.CONFIG.put('YCORE_CONFIG', JSON.stringify(CONFIG));
  });

  it('sin bearer responde 401', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/rollout', { method: 'POST', body: '{}' });

    const response = await handleAdminRollout(request, testEnv());

    expect(response.status).toBe(401);
  });

  it('con payload inválido responde 400', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/rollout', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ channel: 'stable', rollout: 150, actor: 'yummancito' }),
    });

    const response = await handleAdminRollout(request, testEnv());

    expect(response.status).toBe(400);
  });

  it('con un canal que no existe todavía responde 400', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/rollout', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ channel: 'beta', rollout: 50, actor: 'yummancito' }),
    });

    const response = await handleAdminRollout(request, testEnv());

    expect(response.status).toBe(400);
  });

  it('cambia el rollout y deja fila en admin_actions_log', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/rollout', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ channel: 'stable', rollout: 50, actor: 'yummancito' }),
    });

    const response = await handleAdminRollout(request, testEnv());

    expect(response.status).toBe(200);
    const raw = await env.CONFIG.get('YCORE_CONFIG');
    const config = JSON.parse(raw ?? '{}') as { channels: Record<string, { rollout: number }> };
    expect(config.channels['stable']?.rollout).toBe(50);

    const logRow = await env.DB.prepare('SELECT * FROM admin_actions_log').first();
    expect(logRow).toMatchObject({ action: 'rollout', channel: 'stable', actor: 'yummancito' });
  });
});
