import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runBlock } from './block.js';
import { startTestServer, type TestServer } from '../admin-client.test-helpers.js';

describe('runBlock', () => {
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

  it('manda version, reason, forceTo y actor al endpoint de block', async () => {
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

    await runBlock(['--version', '5.0.9', '--reason', 'corrompe la DB local', '--force-to', '5.1.0', '--actor', 'yummancito']);

    expect(JSON.parse(receivedBody)).toEqual({
      version: '5.0.9',
      reason: 'corrompe la DB local',
      forceTo: '5.1.0',
      actor: 'yummancito',
    });
  });

  it('lanza si falta --force-to', async () => {
    process.env['YCORE_WORKER_URL'] = 'https://updates.y-core.app';
    process.env['YCORE_ADMIN_TOKEN'] = 'admin-token';

    await expect(runBlock(['--version', '5.0.9', '--reason', 'x', '--actor', 'y'])).rejects.toThrow('--force-to');
  });
});
