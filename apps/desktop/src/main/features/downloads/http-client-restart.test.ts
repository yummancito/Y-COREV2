import { afterEach, describe, expect, it } from 'vitest';
import { isOk } from '@ycore/result';
import { openDownloadStream, type ResumeInfo } from './http-client.js';
import { readAll, startTestServer, type TestServer } from './http-client.test-helpers.js';

const FULL_CONTENT = 'hello world';

describe('openDownloadStream — 206 real vs servidor que no soporta Range', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('el servidor responde 206: continúa desde el offset, bytesTotal suma lo ya descargado', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(206, { 'content-length': String(FULL_CONTENT.length - 6) });
      res.end(FULL_CONTENT.slice(6));
    });
    const resume: ResumeInfo = { bytesDownloaded: 6, etag: null, lastModified: null };

    const result = await openDownloadStream(server.url, resume);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.mustRestartFromZero).toBe(false);
      expect(result.value.bytesTotal).toBe(FULL_CONTENT.length);
      expect((await readAll(result.value.body)).toString()).toBe(FULL_CONTENT.slice(6));
    }
  });

  it('el servidor "miente" y responde 200 en vez de 206: hay que reiniciar desde 0', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(200, { 'content-length': String(FULL_CONTENT.length) });
      res.end(FULL_CONTENT);
    });
    const resume: ResumeInfo = { bytesDownloaded: 6, etag: null, lastModified: null };

    const result = await openDownloadStream(server.url, resume);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.mustRestartFromZero).toBe(true);
      expect(result.value.bytesTotal).toBe(FULL_CONTENT.length);
      expect((await readAll(result.value.body)).toString()).toBe(FULL_CONTENT);
    }
  });
});
