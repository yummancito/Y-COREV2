/**
 * `services/update-worker` — el ÚNICO `export default { fetch }` de este servicio (ADR-0005, punto 1).
 *
 * Sirve para despachar las cinco rutas del backend de actualizaciones contra
 * una tabla constante, sin ningún framework de routing (cinco rutas fijas no
 * justifican una dependencia). Un `try/catch` alrededor de todo el `fetch`
 * es la última red: un bug nunca puede devolver un stack trace al cliente.
 */

import { handleCheck } from './routes/check.js';
import { handleDownload } from './routes/download.js';
import { handleAdminMaintenance } from './routes/admin/maintenance.js';
import { handleAdminRelease } from './routes/admin/release.js';
import { handleAdminStats } from './routes/admin/stats.js';
import { empty, internalError } from './http/responses.js';
import type { WorkerEnv } from './env.js';

const DOWNLOAD_PATTERN = /^\/v1\/download\/([^/]+)\/([^/]+)$/;

async function route(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const { method } = request;

  if (method === 'GET' && pathname === '/v1/check') return handleCheck(request, env);

  const downloadMatch = method === 'GET' ? DOWNLOAD_PATTERN.exec(pathname) : null;
  if (downloadMatch !== null) {
    const [, version, kind] = downloadMatch;
    return handleDownload(request, env, version!, kind!);
  }

  if (method === 'POST' && pathname === '/v1/admin/maintenance') return handleAdminMaintenance(request, env);
  if (method === 'POST' && pathname === '/v1/admin/release') return handleAdminRelease(request, env);
  if (method === 'GET' && pathname === '/v1/admin/stats') return handleAdminStats(request, env);

  return empty(404);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    try {
      return await route(request, env);
    } catch {
      return internalError();
    }
  },
};
