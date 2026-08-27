import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runMaintenance } from './maintenance.js';
import { startTestServer, type TestServer } from '../admin-client.test-helpers.js';

describe('runMaintenance', () => {
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

  it('activa mantenimiento con --on, --note y --actor', async () => {
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

    await runMaintenance(['--on', '--note', 'migrando R2', '--actor', 'yummancito']);

    expect(JSON.parse(receivedBody)).toEqual({ enabled: true, note: 'migrando R2', actor: 'yummancito' });
  });

  it('lanza si no se pasa --on ni --off', async () => {
    process.env['YCORE_WORKER_URL'] = 'https://updates.y-core.app';
    process.env['YCORE_ADMIN_TOKEN'] = 'admin-token';

    await expect(runMaintenance(['--note', 'x', '--actor', 'y'])).rejects.toThrow('--on o --off');
  });

  it('lanza si se pasan --on y --off a la vez', async () => {
    process.env['YCORE_WORKER_URL'] = 'https://updates.y-core.app';
    process.env['YCORE_ADMIN_TOKEN'] = 'admin-token';

    await expect(runMaintenance(['--on', '--off', '--note', 'x', '--actor', 'y'])).rejects.toThrow('--on o --off');
  });
});
