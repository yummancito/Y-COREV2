import { describe, expect, it } from 'vitest';
import { ManifestSchema } from './manifest.js';

const validManifest = {
  version: '5.1.0',
  channel: 'stable',
  sha512: 'a'.repeat(128),
  size: 98123456,
  blockmapSha512: null,
  notes: { es: 'notas', en: 'notes' },
  signature: 'ZmlybWEtZGUtcHJ1ZWJh',
};

describe('ManifestSchema', () => {
  it('acepta un manifest válido sin blockmap', () => {
    expect(ManifestSchema.safeParse(validManifest).success).toBe(true);
  });

  it('acepta un manifest con blockmapSha512', () => {
    expect(ManifestSchema.safeParse({ ...validManifest, blockmapSha512: 'b'.repeat(128) }).success).toBe(true);
  });

  it('rechaza un manifest sin signature', () => {
    const withoutSignature: Record<string, unknown> = { ...validManifest };
    delete withoutSignature['signature'];
    expect(ManifestSchema.safeParse(withoutSignature).success).toBe(false);
  });
});
