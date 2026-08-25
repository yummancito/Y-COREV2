import { afterEach, describe, expect, it } from 'vitest';
import { isErr } from '@ycore/result';
import { openDownloadStream } from './http-client.js';
import { startTestServer, type TestServer } from './http-client.test-helpers.js';

describe('openDownloadStream — errores de red y HTTP', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('URL inalcanzable devuelve AppError net.unreachable, retriable', async () => {
    const result = await openDownloadStream('http://127.0.0.1:1/file', null);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('net.unreachable');
      expect(result.error.retriable).toBe(true);
    }
  });

  it('un status de error HTTP (404) devuelve AppError net.unreachable no retriable', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });

    const result = await openDownloadStream(server.url, null);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('net.unreachable');
      expect(result.error.retriable).toBe(false);
    }
  });

  it('un 5xx devuelve AppError net.unreachable retriable', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(503);
      res.end();
    });

    const result = await openDownloadStream(server.url, null);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.retriable).toBe(true);
  });
});
