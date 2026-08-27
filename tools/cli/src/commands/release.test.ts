import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runRelease } from './release.js';
import { startTestServer, type TestServer } from '../admin-client.test-helpers.js';

const BASE_FLAGS = [
  '--version', '5.1.0',
  '--channel', 'stable',
  '--rollout', '10',
  '--r2-key', 'releases/5.1.0/Setup.exe',
  '--manifest-key', 'releases/5.1.0/manifest.json',
  '--size', '98123456',
  '--sha512', 'a'.repeat(128),
  '--notes-es', 'notas',
  '--notes-en', 'notes',
];

describe('runRelease', () => {
  let server: TestServer | null = null;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    await server?.close();
    server = null;
    vi.restoreAllMocks();
    delete process.env['YCORE_WORKER_URL'];
    delete process.env['YCORE_ADMIN_TOKEN'];
  });

  it('publica una release sin blockmap ni mandatory', async () => {
    let receivedBody = '';
    server = await startTestServer((req, res) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        receivedBody = raw;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    process.env['YCORE_WORKER_URL'] = server.url;
    process.env['YCORE_ADMIN_TOKEN'] = 'admin-token';

    await runRelease(BASE_FLAGS);

    expect(JSON.parse(receivedBody)).toEqual({
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
    });
  });

  it('lanza si --size no es un número', async () => {
    process.env['YCORE_WORKER_URL'] = 'https://updates.y-core.app';
    process.env['YCORE_ADMIN_TOKEN'] = 'admin-token';

    const flags = BASE_FLAGS.map((f) => (f === '98123456' ? 'no-numero' : f));

    await expect(runRelease(flags)).rejects.toThrow('--size');
  });
});

describe('runRelease — con blockmap', () => {
  let server: TestServer | null = null;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    await server?.close();
    server = null;
    vi.restoreAllMocks();
    delete process.env['YCORE_WORKER_URL'];
    delete process.env['YCORE_ADMIN_TOKEN'];
  });

  it('publica una release con blockmap y mandatory', async () => {
    let receivedBody = '';
    server = await startTestServer((req, res) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        receivedBody = raw;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    process.env['YCORE_WORKER_URL'] = server.url;
    process.env['YCORE_ADMIN_TOKEN'] = 'admin-token';

    await runRelease([
      ...BASE_FLAGS,
      '--blockmap-key', 'releases/5.1.0/Setup.exe.blockmap',
      '--blockmap-sha512', 'b'.repeat(128),
      '--estimated-delta-size', '14200000',
      '--mandatory',
    ]);

    const body = JSON.parse(receivedBody) as Record<string, unknown>;
    expect(body['blockmapKey']).toBe('releases/5.1.0/Setup.exe.blockmap');
    expect(body['estimatedDeltaSize']).toBe(14200000);
    expect(body['mandatory']).toBe(true);
  });
});
