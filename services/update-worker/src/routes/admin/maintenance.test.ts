import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleAdminMaintenance } from './maintenance.js';
import { applyMigrations } from '../../test-migrations.js';
import type { WorkerEnv } from '../../env.js';

const ADMIN_TOKEN = 'admin-token';
const CONFIG = { maintenance: { enabled: false, since: null, note: '' }, channels: {}, blocked: {}, checkIntervalSeconds: 21600 };

function testEnv(): WorkerEnv {
  return { ...env, YCORE_CLIENT_SECRET: 'client-secret', YCORE_ADMIN_TOKEN: ADMIN_TOKEN };
}

describe('handleAdminMaintenance', () => {
  beforeEach(async () => {
    await applyMigrations();
    await env.DB.prepare('DELETE FROM maintenance_log').run();
    await env.CONFIG.put('YCORE_CONFIG', JSON.stringify(CONFIG));
  });

  it('sin bearer responde 401', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/maintenance', { method: 'POST', body: '{}' });

    const response = await handleAdminMaintenance(request, testEnv());

    expect(response.status).toBe(401);
  });

  it('con bearer bueno y payload inválido responde 400', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/maintenance', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ enabled: true }),
    });

    const response = await handleAdminMaintenance(request, testEnv());

    expect(response.status).toBe(400);
  });

  it('activar mantenimiento escribe en KV y deja fila en maintenance_log', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/maintenance', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ enabled: true, note: 'migrando R2', actor: 'yummancito' }),
    });

    const response = await handleAdminMaintenance(request, testEnv());

    expect(response.status).toBe(200);
    const raw = await env.CONFIG.get('YCORE_CONFIG');
    const config = JSON.parse(raw ?? '{}') as { maintenance: { enabled: boolean } };
    expect(config.maintenance.enabled).toBe(true);

    const row = await env.DB.prepare('SELECT * FROM maintenance_log').first();
    expect(row).toMatchObject({ enabled: 1, actor: 'yummancito', note: 'migrando R2' });
  });
});
