import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleAdminBlock } from './block.js';
import { applyMigrations } from '../../test-migrations.js';
import type { WorkerEnv } from '../../env.js';

const ADMIN_TOKEN = 'admin-token';
const CONFIG = { maintenance: { enabled: false, since: null, note: '' }, channels: {}, blocked: {}, checkIntervalSeconds: 21600 };

function testEnv(): WorkerEnv {
  return { ...env, YCORE_CLIENT_SECRET: 'client-secret', YCORE_ADMIN_TOKEN: ADMIN_TOKEN };
}

describe('handleAdminBlock', () => {
  beforeEach(async () => {
    await applyMigrations();
    await env.DB.prepare('DELETE FROM admin_actions_log').run();
    await env.CONFIG.put('YCORE_CONFIG', JSON.stringify(CONFIG));
  });

  it('sin bearer responde 401', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/block', { method: 'POST', body: '{}' });

    const response = await handleAdminBlock(request, testEnv());

    expect(response.status).toBe(401);
  });

  it('con payload inválido responde 400', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/block', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ version: '5.0.9' }),
    });

    const response = await handleAdminBlock(request, testEnv());

    expect(response.status).toBe(400);
  });

  it('bloquea la versión y deja fila en admin_actions_log', async () => {
    const payload = { version: '5.0.9', reason: 'corrompe la DB local', forceTo: '5.1.0', actor: 'yummancito' };
    const request = new Request('https://updates.y-core.app/v1/admin/block', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify(payload),
    });

    const response = await handleAdminBlock(request, testEnv());

    expect(response.status).toBe(200);
    const raw = await env.CONFIG.get('YCORE_CONFIG');
    const config = JSON.parse(raw ?? '{}') as { blocked: Record<string, { reason: string; forceTo: string }> };
    expect(config.blocked['5.0.9']).toEqual({ reason: 'corrompe la DB local', forceTo: '5.1.0' });

    const logRow = await env.DB.prepare('SELECT * FROM admin_actions_log').first();
    expect(logRow).toMatchObject({ action: 'block', version: '5.0.9', actor: 'yummancito', detail: 'corrompe la DB local' });
  });
});
