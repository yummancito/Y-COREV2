import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import worker from './index.js';
import { applyMigrations } from './test-migrations.js';
import type { WorkerEnv } from './env.js';

const CONFIG = { maintenance: { enabled: false, since: null, note: '' }, channels: {}, blocked: {}, checkIntervalSeconds: 21600 };

function testEnv(): WorkerEnv {
  return { ...env, YCORE_CLIENT_SECRET: 'client-secret', YCORE_ADMIN_TOKEN: 'admin-token' };
}

describe('index (fetch handler y routing)', () => {
  beforeEach(async () => {
    await applyMigrations();
    await env.CONFIG.put('YCORE_CONFIG', JSON.stringify(CONFIG));
  });

  it('una ruta desconocida responde 404', async () => {
    const response = await worker.fetch(new Request('https://updates.y-core.app/no-existe'), testEnv());
    expect(response.status).toBe(404);
  });

  it('GET /v1/check despacha a handleCheck', async () => {
    const response = await worker.fetch(new Request('https://updates.y-core.app/v1/check?version=&channel='), testEnv());
    expect(response.status).toBe(200);
  });

  it('GET /v1/download/:version/:kind despacha a handleDownload', async () => {
    const response = await worker.fetch(new Request('https://updates.y-core.app/v1/download/5.1.0/full'), testEnv());
    expect(response.status).toBe(403);
  });

  it('POST /v1/admin/maintenance sin auth responde 401 (llegó a la ruta correcta)', async () => {
    const response = await worker.fetch(
      new Request('https://updates.y-core.app/v1/admin/maintenance', { method: 'POST', body: '{}' }),
      testEnv(),
    );
    expect(response.status).toBe(401);
  });

  it('un método no soportado en una ruta conocida responde 404', async () => {
    const response = await worker.fetch(new Request('https://updates.y-core.app/v1/check', { method: 'POST' }), testEnv());
    expect(response.status).toBe(404);
  });
});
