import { afterEach, describe, expect, it } from 'vitest';
import { postAdmin, getAdmin } from './admin-client.js';
import { startTestServer, type TestServer } from './admin-client.test-helpers.js';

describe('postAdmin', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('manda el bearer y el body, y devuelve el body de la respuesta', async () => {
    let receivedAuth: string | undefined;
    let receivedBody = '';
    server = await startTestServer((req, res) => {
      receivedAuth = req.headers.authorization;
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        receivedBody = raw;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    const result = await postAdmin(server.url, '/v1/admin/maintenance', 'admin-token', { enabled: true });

    expect(receivedAuth).toBe('Bearer admin-token');
    expect(JSON.parse(receivedBody)).toEqual({ enabled: true });
    expect(result).toEqual({ ok: true });
  });

  it('lanza con el status y el body si la respuesta no es 2xx', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(401);
      res.end('no autorizado');
    });

    await expect(postAdmin(server.url, '/v1/admin/maintenance', 'bad-token', {})).rejects.toThrow('401');
  });
});

describe('getAdmin', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('manda el bearer y devuelve el body de la respuesta', async () => {
    let receivedAuth: string | undefined;
    server = await startTestServer((req, res) => {
      receivedAuth = req.headers.authorization;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ stats: [] }));
    });

    const result = await getAdmin(server.url, '/v1/admin/stats?days=7', 'admin-token');

    expect(receivedAuth).toBe('Bearer admin-token');
    expect(result).toEqual({ stats: [] });
  });

  it('lanza con el status si la respuesta no es 2xx', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(500);
      res.end('boom');
    });

    await expect(getAdmin(server.url, '/v1/admin/stats', 'admin-token')).rejects.toThrow('500');
  });
});
