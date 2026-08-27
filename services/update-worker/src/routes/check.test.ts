import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleCheck } from './check.js';
import { applyMigrations } from '../test-migrations.js';
import { insertRelease } from '../data/releases-d1.js';
import type { WorkerEnv } from '../env.js';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const SECRET = 'test-secret';

const CONFIG = {
  maintenance: { enabled: false, since: null, note: '' },
  channels: { stable: { latest: '5.1.0', rollout: 100, minSupported: '4.0.0' } },
  blocked: {},
  checkIntervalSeconds: 21600,
};

async function signedRequest(version: string, channel: string, clientId: string): Promise<Request> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${clientId}${version}${channel}`));
  const sig = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');

  const url = new URL('https://updates.y-core.app/v1/check');
  url.searchParams.set('version', version);
  url.searchParams.set('channel', channel);
  url.searchParams.set('platform', 'win32');
  url.searchParams.set('arch', 'x64');
  url.searchParams.set('clientId', clientId);

  return new Request(url, { headers: { 'x-ycore-signature': sig } });
}

function testEnv(): WorkerEnv {
  return { ...env, YCORE_CLIENT_SECRET: SECRET, YCORE_ADMIN_TOKEN: 'admin-token' };
}

describe('handleCheck', () => {
  beforeEach(async () => {
    await applyMigrations();
    await env.DB.prepare('DELETE FROM releases').run();
    await env.DB.prepare('DELETE FROM check_stats').run();
    await env.CONFIG.put('YCORE_CONFIG', JSON.stringify(CONFIG));
    await insertRelease(env.DB, {
      version: '5.1.0',
      channel: 'stable',
      r2Key: 'releases/5.1.0/Setup.exe',
  manifestKey: 'releases/5.1.0/manifest.json',
      blockmapKey: null,
      size: 100,
      sha512: 'a'.repeat(128),
      blockmapSha512: null,
      estimatedDeltaSize: null,
      notes: { es: 'notas', en: 'notes' },
      mandatory: false,
      publishedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('un cliente atrasado con firma correcta recibe update-available', async () => {
    const request = await signedRequest('5.0.0', 'stable', CLIENT_ID);

    const response = await handleCheck(request, testEnv());
    const body: { status: string } = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('update-available');
  });

  it('sin cabecera de firma responde up-to-date, no un error', async () => {
    const url = new URL('https://updates.y-core.app/v1/check');
    url.searchParams.set('version', '5.0.0');
    url.searchParams.set('channel', 'stable');
    url.searchParams.set('platform', 'win32');
    url.searchParams.set('arch', 'x64');
    url.searchParams.set('clientId', CLIENT_ID);

    const response = await handleCheck(new Request(url), testEnv());
    const body: { status: string } = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('up-to-date');
  });

  it('con parámetros inválidos responde up-to-date, no 400', async () => {
    const url = new URL('https://updates.y-core.app/v1/check?version=');

    const response = await handleCheck(new Request(url), testEnv());
    const body: { status: string } = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('up-to-date');
  });
});
