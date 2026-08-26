import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Manifest } from '@ycore/update-contract';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { verifyArtifactSha512, verifyManifestSignature } from './verify-manifest.js';

type Ed25519Key = Awaited<ReturnType<typeof crypto.subtle.importKey>>;
interface Ed25519KeyPair {
  readonly publicKey: Ed25519Key;
  readonly privateKey: Ed25519Key;
}

function toBase64(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('base64');
}

async function generateKeyPair(): Promise<Ed25519KeyPair> {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  if (!('publicKey' in keyPair) || !('privateKey' in keyPair)) {
    throw new Error('se esperaba un CryptoKeyPair de crypto.subtle.generateKey');
  }
  return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
}

async function publicKeyBase64Of(keyPair: Ed25519KeyPair): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  return toBase64(raw);
}

async function signManifest(keyPair: Ed25519KeyPair, unsigned: Omit<Manifest, 'signature'>): Promise<Manifest> {
  const payload = new TextEncoder().encode(JSON.stringify(unsigned));
  const signature = await crypto.subtle.sign('Ed25519', keyPair.privateKey, payload);
  return { ...unsigned, signature: toBase64(signature) };
}

const UNSIGNED_MANIFEST: Omit<Manifest, 'signature'> = {
  version: '5.1.0',
  channel: 'stable',
  sha512: 'a'.repeat(128),
  size: 98123456,
  blockmapSha512: null,
  notes: { es: 'notas', en: 'notes' },
};

describe('verifyManifestSignature', () => {
  let keyPair: Ed25519KeyPair;
  let otherKeyPair: Ed25519KeyPair;
  let publicKeyBase64: string;
  let otherPublicKeyBase64: string;

  beforeAll(async () => {
    keyPair = await generateKeyPair();
    otherKeyPair = await generateKeyPair();
    publicKeyBase64 = await publicKeyBase64Of(keyPair);
    otherPublicKeyBase64 = await publicKeyBase64Of(otherKeyPair);
  });

  it('acepta una firma válida contra su clave pública', async () => {
    const manifest = await signManifest(keyPair, UNSIGNED_MANIFEST);
    const result = await verifyManifestSignature(manifest, [publicKeyBase64]);
    expect(result.ok).toBe(true);
  });

  it('rechaza una firma hecha con una clave distinta', async () => {
    const manifest = await signManifest(otherKeyPair, UNSIGNED_MANIFEST);
    const result = await verifyManifestSignature(manifest, [publicKeyBase64]);
    expect(result.ok).toBe(false);
  });

  it('rechaza un manifest alterado tras firmarlo', async () => {
    const manifest = await signManifest(keyPair, UNSIGNED_MANIFEST);
    const tampered: Manifest = { ...manifest, sha512: 'b'.repeat(128) };
    const result = await verifyManifestSignature(tampered, [publicKeyBase64]);
    expect(result.ok).toBe(false);
  });

  it('acepta la firma si la clave válida es la segunda de una rotación', async () => {
    const manifest = await signManifest(keyPair, UNSIGNED_MANIFEST);
    const result = await verifyManifestSignature(manifest, [otherPublicKeyBase64, publicKeyBase64]);
    expect(result.ok).toBe(true);
  });

  it('rechaza si la firma no es base64 válido', async () => {
    const manifest = await signManifest(keyPair, UNSIGNED_MANIFEST);
    const result = await verifyManifestSignature({ ...manifest, signature: '***no-es-base64***' }, [publicKeyBase64]);
    expect(result.ok).toBe(false);
  });
});

describe('verifyArtifactSha512', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('acepta un archivo cuyo hash coincide', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ycore-updater-client-'));
    const filePath = join(dir, 'instalador.bin');
    const content = Buffer.from('contenido de prueba del instalador');
    await writeFile(filePath, content);
    const expectedSha512 = createHash('sha512').update(content).digest('hex');

    const result = await verifyArtifactSha512(filePath, expectedSha512);

    expect(result.ok).toBe(true);
  });

  it('rechaza un archivo cuyo hash no coincide', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ycore-updater-client-'));
    const filePath = join(dir, 'instalador.bin');
    await writeFile(filePath, Buffer.from('contenido distinto'));

    const result = await verifyArtifactSha512(filePath, 'f'.repeat(128));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('download.integrity-mismatch');
  });

  it('devuelve io.failed si el archivo no existe', async () => {
    const result = await verifyArtifactSha512('C:/ruta/que/no/existe/instalador.bin', 'a'.repeat(128));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('io.failed');
  });
});
