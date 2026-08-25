import { afterEach, describe, expect, it } from 'vitest';
import { openDownloadStream, type ResumeInfo } from './http-client.js';
import { startTestServer, type TestServer } from './http-client.test-helpers.js';

describe('openDownloadStream — cabeceras de reanudación', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('con resume, pide Range e If-Range con el etag guardado', async () => {
    let receivedRange: string | string[] | undefined;
    let receivedIfRange: string | string[] | undefined;
    server = await startTestServer((req, res) => {
      receivedRange = req.headers.range;
      receivedIfRange = req.headers['if-range'];
      res.writeHead(206, { 'content-length': '6', etag: '"abc"' });
      res.end('world');
    });
    const resume: ResumeInfo = { bytesDownloaded: 6, etag: '"abc"', lastModified: null };

    await openDownloadStream(server.url, resume);

    expect(receivedRange).toBe('bytes=6-');
    expect(receivedIfRange).toBe('"abc"');
  });

  it('bytesDownloaded en 0 no manda Range aunque haya resume', async () => {
    let receivedRange: string | undefined;
    server = await startTestServer((req, res) => {
      receivedRange = req.headers.range;
      res.writeHead(200, { 'content-length': '11' });
      res.end('hello world');
    });
    const resume: ResumeInfo = { bytesDownloaded: 0, etag: '"abc"', lastModified: null };

    await openDownloadStream(server.url, resume);

    expect(receivedRange).toBeUndefined();
  });
});
