#!/usr/bin/env node
/**
 * sign-release-manifest — firma con Ed25519 el manifest de una release ya empaquetada.
 *
 * Sirve como el único lugar del pipeline de CI que toca la clave privada
 * (ADR-0005, punto 5: "el Worker no firma nada, no conoce la clave privada").
 * Calcula sha512/size del instalador y del .blockmap (si existe), construye
 * el manifest sin firmar, lo firma con `node:crypto` (Ed25519 nativo, cero
 * dependencias), y escribe `manifest.json` firmado junto al instalador.
 *
 * Uso (desde `.github/workflows/release-desktop.yml`, nunca en local con la
 * clave real):
 *   node tools/scripts/sign-release-manifest.mjs \
 *     --installer <ruta al Setup.exe> \
 *     --blockmap <ruta al .blockmap, opcional> \
 *     --version 5.1.0 --channel stable \
 *     --notes-es "..." --notes-en "..." \
 *     --out <ruta de salida manifest.json>
 *
 * La clave privada se lee de la variable de entorno YCORE_SIGNING_KEY_BASE64
 * (PKCS#8 DER en base64) — nunca como argumento de línea de comandos, para
 * que no quede en logs de CI ni en el historial de shell.
 *
 * Salida: exit 0 = ok, manifest.json escrito · exit 1 = falta un argumento o
 * la clave, o el archivo del instalador no existe.
 */

import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function requireArg(args, key) {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) {
    console.error(`FALLO: falta --${key}.`);
    process.exit(1);
  }
  return value;
}

async function sha512OfFile(filePath) {
  const hash = createHash('sha512');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

/** Los campos del manifest que participan en la firma — todo salvo `signature` en sí (mismo criterio que verify-manifest.ts). */
function signedPayloadOf(unsigned) {
  return JSON.stringify(unsigned);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const installerPath = requireArg(args, 'installer');
  const version = requireArg(args, 'version');
  const channel = requireArg(args, 'channel');
  const notesEs = requireArg(args, 'notes-es');
  const notesEn = requireArg(args, 'notes-en');
  const outPath = requireArg(args, 'out');
  const blockmapPath = typeof args['blockmap'] === 'string' ? args['blockmap'] : null;

  if (!existsSync(installerPath)) {
    console.error(`FALLO: no existe el instalador en ${installerPath}.`);
    process.exit(1);
  }

  const signingKeyBase64 = process.env['YCORE_SIGNING_KEY_BASE64'];
  if (signingKeyBase64 === undefined || signingKeyBase64.length === 0) {
    console.error('FALLO: falta YCORE_SIGNING_KEY_BASE64 en el entorno.');
    process.exit(1);
  }

  const size = statSync(installerPath).size;
  const sha512 = await sha512OfFile(installerPath);
  const blockmapSha512 = blockmapPath !== null && existsSync(blockmapPath) ? await sha512OfFile(blockmapPath) : null;

  const unsigned = {
    version,
    channel,
    sha512,
    size,
    blockmapSha512,
    notes: { es: notesEs, en: notesEn },
  };

  const { createPrivateKey, sign } = await import('node:crypto');
  const privateKey = createPrivateKey({
    key: Buffer.from(signingKeyBase64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  const signature = sign(null, Buffer.from(signedPayloadOf(unsigned)), privateKey).toString('base64');

  const manifest = { ...unsigned, signature };
  writeFileSync(outPath, JSON.stringify(manifest, null, 2));

  console.log(`OK: manifest firmado escrito en ${outPath} (version ${version}, sha512 ${sha512.slice(0, 16)}...).`);
}

await main();
