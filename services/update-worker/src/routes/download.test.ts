import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleDownload } from './download.js';
import { signDownloadUrl } from '../domain/signed-url.js';
import type { WorkerEnv } from '../env.js';

const SECRET = 'test-secret';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const R2_KEY = 'releases/5.1.0/Setup.exe';
const MANIFEST_R2_KEY = 'releases/5.1.0/manifest.json';
const CONTENT = 'contenido de prueba del instalador';
const MANIFEST_CONTENT = '{"version":"5.1.0"}';

function testEnv(): WorkerEnv {
  return { ...env, YCORE_CLIENT_SECRET: SECRET, YCORE_ADMIN_TOKEN: 'admin-token' };
}

describe('handleDownload', () => {
  beforeEach(async () => {
    await env.RELEASES.put(R2_KEY, CONTENT);
    await env.RELEASES.put(MANIFEST_R2_KEY, MANIFEST_CONTENT);
  });

  it('con kind=manifest y firma válida, sirve el manifest.json (200)', async () => {
    const signed = await signDownloadUrl(SECRET, MANIFEST_R2_KEY, CLIENT_ID, Math.floor(Date.now() / 1000));
    const url = `https://updates.y-core.app/v1/download/5.1.0/manifest?t=${signed.expiresAtSeconds}&sig=${signed.signature}&clientId=${CLIENT_ID}`;

    const response = await handleDownload(new Request(url), testEnv(), '5.1.0', 'manifest');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(MANIFEST_CONTENT);
  });

  it('con una firma válida, sirve el objeto completo (200)', async () => {
    const signed = await signDownloadUrl(SECRET, R2_KEY, CLIENT_ID, Math.floor(Date.now() / 1000));
    const url = `https://updates.y-core.app/v1/download/5.1.0/full?t=${signed.expiresAtSeconds}&sig=${signed.signature}&clientId=${CLIENT_ID}`;

    const response = await handleDownload(new Request(url), testEnv(), '5.1.0', 'full');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(CONTENT);
  });

  it('con firma expirada, responde 403', async () => {
    const signed = await signDownloadUrl(SECRET, R2_KEY, CLIENT_ID, Math.floor(Date.now() / 1000) - 10_000, 60);
    const url = `https://updates.y-core.app/v1/download/5.1.0/full?t=${signed.expiresAtSeconds}&sig=${signed.signature}&clientId=${CLIENT_ID}`;

    const response = await handleDownload(new Request(url), testEnv(), '5.1.0', 'full');

    expect(response.status).toBe(403);
  });

  it('con firma alterada, responde 403', async () => {
    const signed = await signDownloadUrl(SECRET, R2_KEY, CLIENT_ID, Math.floor(Date.now() / 1000));
    const url = `https://updates.y-core.app/v1/download/5.1.0/full?t=${signed.expiresAtSeconds}&sig=deadbeef&clientId=${CLIENT_ID}`;

    const response = await handleDownload(new Request(url), testEnv(), '5.1.0', 'full');

    expect(response.status).toBe(403);
  });

  it('un kind desconocido responde 404', async () => {
    const url = 'https://updates.y-core.app/v1/download/5.1.0/inventado?t=1&sig=x&clientId=x';

    const response = await handleDownload(new Request(url), testEnv(), '5.1.0', 'inventado');

    expect(response.status).toBe(404);
  });

  it('sin parámetros de firma responde 403', async () => {
    const url = 'https://updates.y-core.app/v1/download/5.1.0/full';

    const response = await handleDownload(new Request(url), testEnv(), '5.1.0', 'full');

    expect(response.status).toBe(403);
  });
});
