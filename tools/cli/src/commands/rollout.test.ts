import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runRollout } from './rollout.js';
import { startTestServer, type TestServer } from '../admin-client.test-helpers.js';

describe('runRollout', () => {
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

  it('manda channel, rollout y actor al endpoint de rollout', async () => {
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

    await runRollout(['--channel', 'stable', '--rollout', '50', '--actor', 'yummancito']);

    expect(JSON.parse(receivedBody)).toEqual({ channel: 'stable', rollout: 50, actor: 'yummancito' });
  });

  it('lanza si --rollout no es un número', async () => {
    process.env['YCORE_WORKER_URL'] = 'https://updates.y-core.app';
    process.env['YCORE_ADMIN_TOKEN'] = 'admin-token';

    await expect(runRollout(['--channel', 'stable', '--rollout', 'no-numero', '--actor', 'y'])).rejects.toThrow('--rollout');
  });
});
