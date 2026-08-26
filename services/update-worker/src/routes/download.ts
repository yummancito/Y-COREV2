/**
 * `handleDownload` — `GET /v1/download/:version/:kind`.
 *
 * Sirve como el único punto que valida una firma de descarga y hace
 * streaming del objeto de R2 (ADR-0005, punto 7). No redirige a una URL
 * pública: el bucket es privado, así que el Worker hace de proxy — el
 * egress de R2 es gratis, así que esto no cuesta nada.
 */

import { verifyDownloadSignature } from '../domain/signed-url.js';
import { fetchReleaseObject } from '../data/downloads-r2.js';
import { empty } from '../http/responses.js';
import type { WorkerEnv } from '../env.js';

const VALID_KINDS = new Set(['full', 'blockmap']);

function r2KeyFor(version: string, kind: string): string {
  return kind === 'blockmap' ? `releases/${version}/Setup.exe.blockmap` : `releases/${version}/Setup.exe`;
}

export async function handleDownload(request: Request, env: WorkerEnv, version: string, kind: string): Promise<Response> {
  if (!VALID_KINDS.has(kind)) return empty(404);

  const url = new URL(request.url);
  const expiresAtParam = url.searchParams.get('t');
  const signatureParam = url.searchParams.get('sig');
  const clientId = url.searchParams.get('clientId');
  if (expiresAtParam === null || signatureParam === null || clientId === null) return empty(403);

  const expiresAtSeconds = Number.parseInt(expiresAtParam, 10);
  if (Number.isNaN(expiresAtSeconds)) return empty(403);

  const r2Key = r2KeyFor(version, kind);
  const valid = await verifyDownloadSignature(
    env.YCORE_CLIENT_SECRET,
    r2Key,
    clientId,
    { expiresAtSeconds, signature: signatureParam },
    Math.floor(Date.now() / 1000),
  );
  if (!valid) return empty(403);

  const object = await fetchReleaseObject(env.RELEASES, r2Key, request.headers.get('range'));
  if (object.ok === false) return empty(404);

  const status = object.value.requestedRange === undefined ? 200 : 206;
  const headers: Record<string, string> = { 'content-length': String(object.value.size), 'accept-ranges': 'bytes' };
  return new Response(object.value.body, { status, headers });
}
