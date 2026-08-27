/**
 * Helpers de test para `UpdateService.checkNow`: un servidor HTTP real que
 * simula `services/update-worker` (`/v1/check`, la URL del artifact y la del
 * manifest firmado con Ed25519), y un par de claves Ed25519 real generado con
 * Web Crypto — mismo patrón que `packages/updater-client/src/verify-manifest.test.ts`.
 */

import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Manifest } from '@ycore/update-contract';
import type { UpdateServiceConfig } from './service.js';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

export interface TestServer {
  readonly url: string;
  close(): Promise<void>;
}

export async function startTestServer(handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void): Promise<TestServer> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

type Ed25519Key = Awaited<ReturnType<typeof crypto.subtle.importKey>>;
export interface Ed25519KeyPair {
  readonly publicKey: Ed25519Key;
  readonly privateKey: Ed25519Key;
}

export async function generateKeyPair(): Promise<Ed25519KeyPair> {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  if (!('publicKey' in keyPair) || !('privateKey' in keyPair)) {
    throw new Error('se esperaba un CryptoKeyPair de crypto.subtle.generateKey');
  }
  return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
}

export async function publicKeyBase64Of(keyPair: Ed25519KeyPair): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  return Buffer.from(raw).toString('base64');
}

export async function signManifest(keyPair: Ed25519KeyPair, unsigned: Omit<Manifest, 'signature'>): Promise<Manifest> {
  const payload = new TextEncoder().encode(JSON.stringify(unsigned));
  const signature = await crypto.subtle.sign('Ed25519', keyPair.privateKey, payload);
  return { ...unsigned, signature: Buffer.from(signature).toString('base64') };
}

export function sha512Of(content: string): string {
  return createHash('sha512').update(content).digest('hex');
}

/** Payload de `/v1/check` con `status: update-available`, apuntando a las rutas del propio servidor de test. */
export function updateAvailablePayload(serverUrl: string, installerSize: number, installerSha512: string): unknown {
  return {
    status: 'update-available',
    version: '5.1.0',
    channel: 'stable',
    mandatory: false,
    notes: { es: 'notas', en: 'notes' },
    artifact: {
      kind: 'nsis',
      size: installerSize,
      sha512: installerSha512,
      url: `${serverUrl}/artifact`,
      urlExpiresAt: '2026-01-01T00:00:00.000Z',
      manifestUrl: `${serverUrl}/manifest`,
    },
    delta: null,
    checkAgainInSeconds: 21600,
  };
}

/** Config base de `UpdateService` para los tests: apunta al servidor de test dado, con la clave pública dada. */
export function baseConfig(server: TestServer, publicKeyBase64: string): UpdateServiceConfig {
  return {
    workerBaseUrl: server.url,
    clientSecret: 'client-secret',
    manifestPublicKeysBase64: [publicKeyBase64],
    currentVersion: '5.0.0',
    channel: 'stable',
    clientId: CLIENT_ID,
  };
}
