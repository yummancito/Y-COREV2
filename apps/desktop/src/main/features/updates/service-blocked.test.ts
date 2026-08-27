import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { UpdateService } from './service.js';
import { startTestServer, generateKeyPair, publicKeyBase64Of, baseConfig, type TestServer, type Ed25519KeyPair } from './service.test-helpers.js';

describe('UpdateService.checkNow — kill-switch (blocked)', () => {
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

  it('si el Worker responde blocked, el estado refleja el kill-switch', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'blocked',
          reason: 'critical-bug',
          message: { es: 'Esta versión ya no es compatible.', en: 'This version is no longer supported.' },
          forceUpdateTo: '5.1.0',
        }),
      );
    });
    const service = new UpdateService(baseConfig(server, publicKeyBase64));

    await service.checkNow();

    expect(service.getStatus()).toEqual({
      phase: 'blocked',
      reason: 'critical-bug',
      message: { es: 'Esta versión ya no es compatible.', en: 'This version is no longer supported.' },
      forceUpdateTo: '5.1.0',
    });
  });
});
