import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { UpdateService } from './service.js';
import { startTestServer, generateKeyPair, publicKeyBase64Of, baseConfig, type TestServer, type Ed25519KeyPair } from './service.test-helpers.js';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

describe('UpdateService.checkNow — sin actualización', () => {
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

  it('sin actualización disponible, queda en up-to-date', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'up-to-date', checkAgainInSeconds: 21600 }));
    });
    const service = new UpdateService(baseConfig(server, publicKeyBase64));

    await service.checkNow();

    expect(service.getStatus()).toEqual({ phase: 'up-to-date' });
  });
});

describe('UpdateService.checkNow — configuración inerte', () => {
  it('con clientSecret vacío (config inerte), degrada a up-to-date en vez de rechazar la promesa', async () => {
    const service = new UpdateService({
      workerBaseUrl: 'http://127.0.0.1:0',
      clientSecret: '',
      manifestPublicKeysBase64: [],
      currentVersion: '5.0.0',
      channel: 'stable',
      clientId: CLIENT_ID,
    });

    await expect(service.checkNow()).resolves.toBeUndefined();
    expect(service.getStatus()).toEqual({ phase: 'up-to-date' });
  });
});

describe('UpdateService.installNow', () => {
  it('sin actualización lista, no hace nada', () => {
    const service = new UpdateService({
      workerBaseUrl: 'http://127.0.0.1:0',
      clientSecret: '',
      manifestPublicKeysBase64: [],
      currentVersion: '5.0.0',
      channel: 'stable',
      clientId: CLIENT_ID,
    });
    let quit = false;

    service.installNow(() => (quit = true));

    expect(quit).toBe(false);
  });
});
