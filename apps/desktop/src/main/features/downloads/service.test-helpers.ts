/**
 * Helpers compartidos por los tests de `DownloadService` — sirven un ZIP
 * real desde un servidor HTTP real, con soporte de Range, para probar el
 * ciclo completo (descarga -> verificación -> extracción -> instalación)
 * contra E/S de verdad, no mocks.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildZip } from './extractor.test-helpers.js';
import { startTestServer, type TestServer } from './http-client.test-helpers.js';
import type { DownloadRepository } from './repository.js';

/** Sirve `content` completo o, si llega `Range`, solo desde el offset pedido (206 real). */
function serveWithRangeSupport(content: Buffer, req: IncomingMessage, res: ServerResponse): void {
  const range = req.headers.range;
  if (typeof range === 'string') {
    const start = Number.parseInt(range.replace('bytes=', '').split('-')[0] ?? '0', 10);
    res.writeHead(206, { 'content-length': String(content.length - start) });
    res.end(content.subarray(start));
    return;
  }
  res.writeHead(200, { 'content-length': String(content.length) });
  res.end(content);
}

/** Arma un ZIP real en `dir`, lo sirve por HTTP (con soporte de Range) y devuelve su hash. */
export async function serveZipFixture(
  dir: string,
  entries: Record<string, string>,
): Promise<{ server: TestServer; sha256: string }> {
  const zipPath = join(dir, 'fixture.zip');
  await buildZip(zipPath, entries);
  const content = readFileSync(zipPath);
  const sha256 = createHash('sha256').update(content).digest('hex');

  const server = await startTestServer((req, res) => serveWithRangeSupport(content, req, res));

  return { server, sha256 };
}

/** El último valor de la cabecera `Range` recibida por un servidor de fixture. Mutable a propósito. */
export interface CapturedRange {
  value: string | string[] | undefined;
}

/**
 * Inserta una fila que simula el estado exacto que deja un `kill -9` a mitad
 * de descarga: `downloading` con `bytesDownloaded` > 0, sin que nadie haya
 * llamado a `pause()`. Usado por el test de `resumeInterrupted()`.
 */
export function insertInterruptedDownload(
  repository: DownloadRepository,
  args: {
    id: string;
    sourceUrl: string;
    destinationPath: string;
    installPath: string;
    expectedSha256: string;
    bytesDownloaded: number;
  },
): void {
  repository.insert(args.id, {
    appId: 730,
    sourceUrl: args.sourceUrl,
    destinationPath: args.destinationPath,
    installPath: args.installPath,
    expectedSha256: args.expectedSha256,
    etag: null,
    lastModified: null,
    segmentIndex: 0,
    segmentCount: 1,
    retryCount: 0,
    createdAt: 'now',
    updatedAt: 'now',
  });
  repository.save(
    { id: args.id, status: 'downloading', bytesDownloaded: args.bytesDownloaded, bytesTotal: null },
    'now',
  );
}

/** Arma un ZIP real y lo sirve por HTTP con soporte de Range, capturando la cabecera Range recibida. */
export async function serveZipFixtureCapturingRange(
  dir: string,
  entries: Record<string, string>,
): Promise<{ server: TestServer; sha256: string; buffer: Buffer; capturedRange: CapturedRange }> {
  const zipPath = join(dir, 'fixture.zip');
  await buildZip(zipPath, entries);
  const buffer = readFileSync(zipPath);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const capturedRange: CapturedRange = { value: undefined };

  const server = await startTestServer((req, res) => {
    capturedRange.value = req.headers.range;
    serveWithRangeSupport(buffer, req, res);
  });

  return { server, sha256, buffer, capturedRange };
}
