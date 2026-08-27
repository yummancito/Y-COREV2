#!/usr/bin/env node
/**
 * verify-embedded-update-config — comprueba que el `.exe` que se está a
 * punto de publicar realmente sabe hablar con el Worker (ADR-0006, punto 5.2/5.3).
 *
 * Tres comprobaciones, en orden, cualquiera detiene el release:
 *   1. Que `out/main/index.js` contiene el host de `YCORE_WORKER_URL`. Si no
 *      está, `define` no corrió con las variables presentes (ver ADR-0006,
 *      punto 2: `package:win` no reconstruye por sí solo) y el `.exe` que se
 *      va a firmar y publicar es inerte.
 *   2. Un smoke test real: `GET /v1/check` contra el Worker de producción,
 *      con un `clientId` UUID v4 recién generado, una versión sintética que
 *      nunca estará publicada, y `X-YCore-Signature` calculada con el mismo
 *      `YCORE_CLIENT_SECRET` que se acaba de embeber. Se exige `HTTP 200`
 *      con forma de respuesta válida.
 *   3. Por ADR-0005 punto 4, una firma HMAC inválida también responde 200
 *      con `up-to-date` — el paso 2 por sí solo NO distingue un secreto
 *      desincronizado de uno correcto. La única señal real está en
 *      `check_stats` (D1): una firma rechazada cuenta como `outcome =
 *      'rejected'` para esa versión/canal. Este paso consulta esa fila con
 *      `wrangler d1 execute --remote` y falla si el conteo de `rejected`
 *      para la versión sintética de este run es mayor que cero — eso
 *      significa que `YCORE_CLIENT_SECRET` en GitHub y el que se subió con
 *      `wrangler secret put` en el Worker ya no coinciden (ver
 *      aprendizaje.md, 2026-08-27, sobre lo ciego que es depurar esto sin
 *      esta señal).
 *
 * Uso:
 *   node tools/scripts/verify-embedded-update-config.mjs --bundle <ruta a out/main/index.js>
 *
 * Variables de entorno requeridas: YCORE_WORKER_URL, YCORE_CLIENT_SECRET
 * (los mismos GitHub Secrets ya usados para compilar el bundle),
 * CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID (para el paso 3, D1:Edit).
 *
 * Salida: exit 0 = ok · exit 1 = el host no está embebido, el smoke test no
 *   responde con forma válida, o check_stats confirma una firma rechazada.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    args[token.slice(2)] = argv[i + 1];
    i += 1;
  }
  return args;
}

function fail(message) {
  console.error(`FALLO: verify-embedded-update-config — ${message}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const bundlePath = args['bundle'];
if (typeof bundlePath !== 'string' || bundlePath.length === 0) {
  fail('falta --bundle <ruta a out/main/index.js>.');
}

const workerUrl = process.env['YCORE_WORKER_URL'];
const clientSecret = process.env['YCORE_CLIENT_SECRET'];
if (workerUrl === undefined || workerUrl.length === 0) fail('falta YCORE_WORKER_URL en el entorno.');
if (clientSecret === undefined || clientSecret.length === 0) fail('falta YCORE_CLIENT_SECRET en el entorno.');

if (!existsSync(bundlePath)) {
  fail(`no existe ${bundlePath} — ¿corrió \`pnpm --filter @ycore/desktop build\` antes que este paso?`);
}

const bundle = readFileSync(bundlePath, 'utf8');
const workerHost = new URL(workerUrl).host;
if (!bundle.includes(workerHost)) {
  fail(
    `${bundlePath} no contiene "${workerHost}" — el define de electron.vite.config.ts no corrió con ` +
      'YCORE_WORKER_URL presente (ADR-0006). El .exe que se firmaría quedaría inerte.',
  );
}
console.log(`OK: ${bundlePath} contiene el host del Worker embebido.`);

const clientId = randomUUID();
const smokeVersion = '0.0.0-smoke-test';
const smokeChannel = 'stable';
const signature = createHmac('sha256', clientSecret).update(`${clientId}${smokeVersion}${smokeChannel}`).digest('hex');

const checkUrl = new URL('/v1/check', workerUrl);
checkUrl.searchParams.set('version', smokeVersion);
checkUrl.searchParams.set('channel', smokeChannel);
checkUrl.searchParams.set('platform', 'win32');
checkUrl.searchParams.set('arch', 'x64');
checkUrl.searchParams.set('clientId', clientId);

let response;
try {
  response = await fetch(checkUrl, { headers: { 'X-YCore-Signature': signature } });
} catch (error) {
  fail(`no se pudo contactar ${workerUrl}/v1/check: ${error instanceof Error ? error.message : String(error)}`);
}

if (!response.ok) {
  fail(`${workerUrl}/v1/check respondió HTTP ${response.status} — el Worker no está sano.`);
}

const body = await response.json();
if (body.status !== 'up-to-date' || typeof body.checkAgainInSeconds !== 'number') {
  fail(`respuesta inesperada de ${workerUrl}/v1/check: ${JSON.stringify(body)}`);
}
console.log(`OK: ${workerUrl}/v1/check respondió con forma válida.`);

const cloudflareApiToken = process.env['CLOUDFLARE_API_TOKEN'];
const cloudflareAccountId = process.env['CLOUDFLARE_ACCOUNT_ID'];
const d1DatabaseName = process.env['YCORE_D1_DATABASE_NAME'] ?? 'ycore_updates';
if (cloudflareApiToken === undefined || cloudflareAccountId === undefined) {
  fail('faltan CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID — necesarios para leer check_stats y distinguir una firma aceptada de una rechazada (ADR-0005 punto 4).');
}

const today = new Date().toISOString().slice(0, 10);
const sql = `SELECT count FROM check_stats WHERE day = '${today}' AND version = '${smokeVersion}' AND channel = '${smokeChannel}' AND outcome = 'rejected';`;

let d1Output;
try {
  d1Output = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', d1DatabaseName, '--remote', '--json', '--command', sql],
    {
      cwd: 'services/update-worker',
      env: { ...process.env, CLOUDFLARE_API_TOKEN: cloudflareApiToken, CLOUDFLARE_ACCOUNT_ID: cloudflareAccountId },
      encoding: 'utf8',
    },
  );
} catch (error) {
  fail(`no se pudo consultar check_stats vía wrangler d1 execute: ${error instanceof Error ? error.message : String(error)}`);
}

const rows = JSON.parse(d1Output)[0]?.results ?? [];
const rejectedCount = rows[0]?.count ?? 0;
if (rejectedCount > 0) {
  fail(
    `check_stats registró ${rejectedCount} check(s) 'rejected' para la versión de smoke test — ` +
      'YCORE_CLIENT_SECRET en GitHub no coincide con el que está en `wrangler secret put` del Worker.',
  );
}

console.log('OK: check_stats confirma que la firma HMAC embebida fue aceptada — el secret está sincronizado.');
process.exit(0);
