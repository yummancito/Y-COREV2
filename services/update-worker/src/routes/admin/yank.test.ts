import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleAdminYank } from './yank.js';
import { applyMigrations } from '../../test-migrations.js';
import type { WorkerEnv } from '../../env.js';

const ADMIN_TOKEN = 'admin-token';

function testEnv(): WorkerEnv {
  return { ...env, YCORE_CLIENT_SECRET: 'client-secret', YCORE_ADMIN_TOKEN: ADMIN_TOKEN };
}

async function insertSampleRelease(): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO releases (version, channel, r2_key, blockmap_key, size, sha512, blockmap_sha512, estimated_delta_size, notes_json, mandatory, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind('5.1.0', 'stable', 'releases/5.1.0/Setup.exe', null, 100, 'a'.repeat(128), null, null, '{"es":"","en":""}', 0, '2026-01-01T00:00:00.000Z')
    .run();
}

describe('handleAdminYank', () => {
  beforeEach(async () => {
    await applyMigrations();
    await env.DB.prepare('DELETE FROM releases').run();
    await env.DB.prepare('DELETE FROM admin_actions_log').run();
    await insertSampleRelease();
  });

  it('sin bearer responde 401', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/yank', { method: 'POST', body: '{}' });

    const response = await handleAdminYank(request, testEnv());

    expect(response.status).toBe(401);
  });

  it('con payload inválido responde 400', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/yank', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ actor: 'yummancito' }),
    });

    const response = await handleAdminYank(request, testEnv());

    expect(response.status).toBe(400);
  });

  it('retira la release y deja fila en admin_actions_log', async () => {
    const request = new Request('https://updates.y-core.app/v1/admin/yank', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ version: '5.1.0', actor: 'yummancito' }),
    });

    const response = await handleAdminYank(request, testEnv());

    expect(response.status).toBe(200);
    const row = await env.DB.prepare('SELECT yanked FROM releases WHERE version = ?').bind('5.1.0').first();
    expect(row).toMatchObject({ yanked: 1 });

    const logRow = await env.DB.prepare('SELECT * FROM admin_actions_log').first();
    expect(logRow).toMatchObject({ action: 'yank', version: '5.1.0', actor: 'yummancito' });
  });
});
