import { afterEach, describe, expect, it } from 'vitest';
import { checkForUpdate, type CheckClientInput } from './check-client.js';
import { startTestServer, type TestServer } from './check-client.test-helpers.js';

const BASE_INPUT: CheckClientInput = {
  version: '5.0.0',
  channel: 'stable',
  platform: 'win32',
  arch: 'x64',
  clientId: '11111111-1111-4111-8111-111111111111',
  signature: 'firma-de-prueba',
};

describe('checkForUpdate — caso feliz', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('devuelve la respuesta real si el servidor responde con forma válida', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'up-to-date', checkAgainInSeconds: 3600 }));
    });

    const result = await checkForUpdate(server.url, BASE_INPUT);

    expect(result).toEqual({ status: 'up-to-date', checkAgainInSeconds: 3600 });
  });

  it('manda la firma en la cabecera X-YCore-Signature', async () => {
    let receivedSignature: string | undefined;
    server = await startTestServer((req, res) => {
      receivedSignature = req.headers['x-ycore-signature'] as string | undefined;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'up-to-date', checkAgainInSeconds: 3600 }));
    });

    await checkForUpdate(server.url, BASE_INPUT);

    expect(receivedSignature).toBe('firma-de-prueba');
  });
});

describe('checkForUpdate — cualquier fallo se trata como up-to-date silencioso', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('devuelve up-to-date si el status HTTP no es ok', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'boom' }));
    });

    const result = await checkForUpdate(server.url, BASE_INPUT);

    expect(result).toEqual({ status: 'up-to-date', checkAgainInSeconds: 21600 });
  });

  it('devuelve up-to-date si el body no valida contra CheckResponseSchema', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ esto: 'no es una CheckResponse valida' }));
    });

    const result = await checkForUpdate(server.url, BASE_INPUT);

    expect(result).toEqual({ status: 'up-to-date', checkAgainInSeconds: 21600 });
  });

  it('devuelve up-to-date si el body no es JSON válido', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('esto no es json');
    });

    const result = await checkForUpdate(server.url, BASE_INPUT);

    expect(result).toEqual({ status: 'up-to-date', checkAgainInSeconds: 21600 });
  });
});

describe('checkForUpdate — fallos de transporte también son up-to-date silencioso', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('devuelve up-to-date si la conexión falla', async () => {
    server = await startTestServer((_req, res) => {
      res.destroy();
    });

    const result = await checkForUpdate(server.url, BASE_INPUT);

    expect(result).toEqual({ status: 'up-to-date', checkAgainInSeconds: 21600 });
  });

  it('devuelve up-to-date si el servidor tarda más que el timeout', async () => {
    server = await startTestServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'up-to-date', checkAgainInSeconds: 3600 }));
      }, 200);
    });

    const result = await checkForUpdate(server.url, BASE_INPUT, 20);

    expect(result).toEqual({ status: 'up-to-date', checkAgainInSeconds: 21600 });
  });
});
