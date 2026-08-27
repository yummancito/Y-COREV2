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
import { handleAdminYank } from './routes/admin/yank.js';
import { handleAdminRollout } from './routes/admin/rollout.js';
import { handleAdminBlock } from './routes/admin/block.js';
import { empty, internalError } from './http/responses.js';
import type { WorkerEnv } from './env.js';

const DOWNLOAD_PATTERN = /^\/v1\/download\/([^/]+)\/([^/]+)$/;

/** Una entrada de la tabla de rutas: método + path exacto -> handler. */
interface Route {
  readonly method: string;
  readonly pathname: string;
  readonly handler: (request: Request, env: WorkerEnv) => Promise<Response>;
}

/** Tabla constante de rutas exactas (todo lo que no sea `/v1/download/:version/:kind`, que usa un patrón aparte). */
const ROUTES: readonly Route[] = [
  { method: 'GET', pathname: '/v1/check', handler: handleCheck },
  { method: 'POST', pathname: '/v1/admin/maintenance', handler: handleAdminMaintenance },
  { method: 'POST', pathname: '/v1/admin/release', handler: handleAdminRelease },
  { method: 'POST', pathname: '/v1/admin/yank', handler: handleAdminYank },
  { method: 'POST', pathname: '/v1/admin/rollout', handler: handleAdminRollout },
  { method: 'POST', pathname: '/v1/admin/block', handler: handleAdminBlock },
  { method: 'GET', pathname: '/v1/admin/stats', handler: handleAdminStats },
];

async function route(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const { method } = request;

  const downloadMatch = method === 'GET' ? DOWNLOAD_PATTERN.exec(pathname) : null;
  if (downloadMatch !== null) {
    const [, version, kind] = downloadMatch;
    return handleDownload(request, env, version!, kind!);
  }

  const matched = ROUTES.find((r) => r.method === method && r.pathname === pathname);
  if (matched !== undefined) return matched.handler(request, env);

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
