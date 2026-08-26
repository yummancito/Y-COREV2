import { describe, expect, it } from 'vitest';
import { signDownloadUrl, verifyDownloadSignature } from './signed-url.js';

const SECRET = 'test-secret';
const R2_KEY = 'releases/5.1.0/Setup.exe';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

describe('signDownloadUrl y verifyDownloadSignature', () => {
  it('una firma recién generada es válida antes de expirar', async () => {
    const now = 1_000_000;
    const signed = await signDownloadUrl(SECRET, R2_KEY, CLIENT_ID, now);

    const valid = await verifyDownloadSignature(SECRET, R2_KEY, CLIENT_ID, signed, now + 60);

    expect(valid).toBe(true);
  });

  it('una firma expirada es inválida', async () => {
    const now = 1_000_000;
    const signed = await signDownloadUrl(SECRET, R2_KEY, CLIENT_ID, now, 900);

    const valid = await verifyDownloadSignature(SECRET, R2_KEY, CLIENT_ID, signed, now + 901);

    expect(valid).toBe(false);
  });

  it('una firma alterada en un byte es inválida', async () => {
    const now = 1_000_000;
    const signed = await signDownloadUrl(SECRET, R2_KEY, CLIENT_ID, now);
    const tampered = { ...signed, signature: `${signed.signature.slice(0, -1)}0` };

    const valid = await verifyDownloadSignature(SECRET, R2_KEY, CLIENT_ID, tampered, now + 10);

    expect(valid).toBe(false);
  });

  it('la firma de una clave R2 no sirve para descargar otra', async () => {
    const now = 1_000_000;
    const signed = await signDownloadUrl(SECRET, R2_KEY, CLIENT_ID, now);

    const valid = await verifyDownloadSignature(SECRET, 'releases/5.1.0/otro.exe', CLIENT_ID, signed, now + 10);

    expect(valid).toBe(false);
  });

  it('la firma de un cliente no sirve para otro clientId', async () => {
    const now = 1_000_000;
    const signed = await signDownloadUrl(SECRET, R2_KEY, CLIENT_ID, now);

    const valid = await verifyDownloadSignature(SECRET, R2_KEY, '22222222-2222-4222-8222-222222222222', signed, now + 10);

    expect(valid).toBe(false);
  });
});
