import { afterEach, describe, expect, it } from 'vitest';
import { isOk } from '@ycore/result';
import { openDownloadStream } from './http-client.js';
import { readAll, startTestServer, type TestServer } from './http-client.test-helpers.js';

describe('openDownloadStream — descarga completa desde cero', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('sin resume, el servidor responde 200 con el contenido', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(200, { 'content-length': '11', etag: '"abc"' });
      res.end('hello world');
    });

    const result = await openDownloadStream(server.url, null);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.mustRestartFromZero).toBe(false);
      expect(result.value.bytesTotal).toBe(11);
      expect(result.value.etag).toBe('"abc"');
      expect((await readAll(result.value.body)).toString()).toBe('hello world');
    }
  });
});
