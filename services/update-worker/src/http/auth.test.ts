import { describe, expect, it } from 'vitest';
import { isValidAdminToken, isValidClientSignature } from './auth.js';

describe('isValidAdminToken', () => {
  it('acepta un bearer correcto', () => {
    expect(isValidAdminToken('Bearer secreto', 'secreto')).toBe(true);
  });

  it('rechaza sin cabecera Authorization', () => {
    expect(isValidAdminToken(null, 'secreto')).toBe(false);
  });

  it('rechaza un formato distinto de Bearer', () => {
    expect(isValidAdminToken('Basic secreto', 'secreto')).toBe(false);
  });

  it('rechaza un token incorrecto', () => {
    expect(isValidAdminToken('Bearer otro', 'secreto')).toBe(false);
  });
});

describe('isValidClientSignature', () => {
  const secret = 'client-secret';

  async function sign(clientId: string, version: string, channel: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${clientId}${version}${channel}`));
    return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  it('acepta una firma correcta', async () => {
    const signature = await sign('client-1', '5.0.0', 'stable');
    const valid = await isValidClientSignature(signature, secret, 'client-1', '5.0.0', 'stable');
    expect(valid).toBe(true);
  });

  it('rechaza sin cabecera', async () => {
    const valid = await isValidClientSignature(null, secret, 'client-1', '5.0.0', 'stable');
    expect(valid).toBe(false);
  });

  it('rechaza una firma alterada en un byte', async () => {
    const signature = await sign('client-1', '5.0.0', 'stable');
    const tampered = `${signature.slice(0, -1)}0`;
    const valid = await isValidClientSignature(tampered, secret, 'client-1', '5.0.0', 'stable');
    expect(valid).toBe(false);
  });

  it('rechaza una firma calculada para otra versión', async () => {
    const signature = await sign('client-1', '5.0.0', 'stable');
    const valid = await isValidClientSignature(signature, secret, 'client-1', '5.9.9', 'stable');
    expect(valid).toBe(false);
  });
});
