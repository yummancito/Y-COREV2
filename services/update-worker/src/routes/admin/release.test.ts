import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleAdminRelease } from './release.js';
import { applyMigrations } from '../../test-migrations.js';
import type { WorkerEnv } from '../../env.js';

const ADMIN_TOKEN = 'admin-token';
const CONFIG = { maintenance: { enabled: false, since: null, note: '' }, channels: {}, blocked: {}, checkIntervalSeconds: 21600 };

const validPayload = {
  version: '5.1.0',
  channel: 'stable',
  rollout: 10,
  r2Key: 'releases/5.1.0/Setup.exe',
  blockmapKey: null,
  manifestKey: 'releases/5.1.0/manifest.json',
  size: 98123456,
  sha512: 'a'.repeat(128),
  blockmapSha512: null,
  estimatedDeltaSize: null,
  notes: { es: 'notas', en: 'notes' },
  mandatory: false,
};

function testEnv(): WorkerEnv {
  return { ...env, YCORE_CLIENT_SECRET: 'client-secret', YCORE_ADMIN_TOKEN: ADMIN_TOKEN };
}

describe('handleAdminRelease', () => {
  beforeEach(async () => {
    await applyMigrations();
    await env.DB.prepare('DELETE FROM releases').run();
    await env.CONFIG.put('YCORE_CONFIG', JSON.stringify(CONFIG));
  });

  it('sin bearer responde 401', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/release', { method: 'POST', body: '{}' });

    const response = await handleAdminRelease(request, testEnv());

    expect(response.status).toBe(401);
  });

  it('publica una release: inserta en D1 y actualiza el canal en KV', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/release', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify(validPayload),
    });

    const response = await handleAdminRelease(request, testEnv());

    expect(response.status).toBe(200);
    const row = await env.DB.prepare('SELECT * FROM releases WHERE version = ?').bind('5.1.0').first();
    expect(row).toMatchObject({ version: '5.1.0', channel: 'stable' });

    const raw = await env.CONFIG.get('YCORE_CONFIG');
    const config = JSON.parse(raw!) as { channels: Record<string, { latest: string; rollout: number }> };
    expect(config.channels['stable']).toMatchObject({ latest: '5.1.0', rollout: 10 });
  });

  it('con payload inválido responde 400', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/release', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ ...validPayload, rollout: 150 }),
    });

    const response = await handleAdminRelease(request, testEnv());

    expect(response.status).toBe(400);
  });
});
