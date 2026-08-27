import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { UpdateService } from './service.js';
import {
  startTestServer,
  generateKeyPair,
  publicKeyBase64Of,
  signManifest,
  sha512Of,
  updateAvailablePayload,
  baseConfig,
  type TestServer,
  type Ed25519KeyPair,
} from './service.test-helpers.js';

const INSTALLER_CONTENT = 'contenido binario del instalador';

describe('UpdateService.checkNow — descarga y verificación completa', () => {
  let server: TestServer | null = null;
  let keyPair: Ed25519KeyPair;
  let publicKeyBase64: string;

  beforeAll(async () => {
    keyPair = await generateKeyPair();
    publicKeyBase64 = await publicKeyBase64Of(keyPair);
  });

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('con actualización disponible, descarga y verifica hasta ready-to-install', async () => {
    const manifest = await signManifest(keyPair, {
      version: '5.1.0',
      channel: 'stable',
      sha512: sha512Of(INSTALLER_CONTENT),
      size: INSTALLER_CONTENT.length,
      blockmapSha512: null,
      notes: { es: 'notas', en: 'notes' },
    });

    server = await startTestServer((req, res) => {
      if (req.url?.startsWith('/v1/check')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(updateAvailablePayload(server!.url, INSTALLER_CONTENT.length, sha512Of(INSTALLER_CONTENT))));
        return;
      }
      if (req.url === '/manifest') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(manifest));
        return;
      }
      if (req.url === '/artifact') {
        res.writeHead(200);
        res.end(INSTALLER_CONTENT);
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const service = new UpdateService(baseConfig(server, publicKeyBase64));
    await service.checkNow();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(service.getStatus()).toEqual({ phase: 'ready-to-install', version: '5.1.0', mandatory: false });
  });
});
