import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStats } from './stats.js';
import { startTestServer, type TestServer } from '../admin-client.test-helpers.js';

describe('runStats', () => {
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

  it('pide /v1/admin/stats con el days por defecto (7) e imprime el resultado', async () => {
    let receivedUrl = '';
    server = await startTestServer((req, res) => {
      receivedUrl = req.url ?? '';
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ stats: [] }));
    });
    process.env['YCORE_WORKER_URL'] = server.url;
    process.env['YCORE_ADMIN_TOKEN'] = 'admin-token';

    await runStats([]);

    expect(receivedUrl).toBe('/v1/admin/stats?days=7');
    expect(console.log).toHaveBeenCalledWith(JSON.stringify({ stats: [] }, null, 2));
  });

  it('respeta --days', async () => {
    let receivedUrl = '';
    server = await startTestServer((req, res) => {
      receivedUrl = req.url ?? '';
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ stats: [] }));
    });
    process.env['YCORE_WORKER_URL'] = server.url;
    process.env['YCORE_ADMIN_TOKEN'] = 'admin-token';

    await runStats(['--days', '30']);

    expect(receivedUrl).toBe('/v1/admin/stats?days=30');
  });
});
