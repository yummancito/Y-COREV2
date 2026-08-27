import { describe, expect, it } from 'vitest';
import { CheckResponseSchema } from './check.js';

const validUpdateAvailable = {
  status: 'update-available',
  version: '5.1.0',
  channel: 'stable',
  mandatory: false,
  notes: { es: 'notas', en: 'notes' },
  artifact: {
    kind: 'nsis',
    size: 98123456,
    sha512: 'a'.repeat(128),
    url: 'https://updates.y-core.app/v1/download/5.1.0/full?t=1&sig=abc',
    urlExpiresAt: '2026-01-01T00:00:00.000Z',
    manifestUrl: 'https://updates.y-core.app/v1/download/5.1.0/manifest?t=1&sig=abc',
  },
  delta: null,
  checkAgainInSeconds: 21600,
};

describe('CheckResponseSchema — update-available', () => {
  it('acepta una respuesta completa sin diferencial', () => {
    expect(CheckResponseSchema.safeParse(validUpdateAvailable).success).toBe(true);
  });

  it('acepta una respuesta con diferencial', () => {
    const withDelta = {
      ...validUpdateAvailable,
      delta: { fromVersion: '5.0.0', blockmapUrl: 'https://updates.y-core.app/v1/download/5.1.0/blockmap?t=1&sig=abc', estimatedSize: 14200000 },
    };
    expect(CheckResponseSchema.safeParse(withDelta).success).toBe(true);
  });

  it('rechaza un artifact sin sha512', () => {
    const invalid = { ...validUpdateAvailable, artifact: { ...validUpdateAvailable.artifact, sha512: undefined } };
    expect(CheckResponseSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('CheckResponseSchema — blocked', () => {
  it('acepta una respuesta de kill-switch', () => {
    const blocked = {
      status: 'blocked',
      reason: 'critical-bug',
      message: { es: 'error crítico', en: 'critical bug' },
      forceUpdateTo: '5.1.0',
    };
    expect(CheckResponseSchema.safeParse(blocked).success).toBe(true);
  });

  it('rechaza un status desconocido', () => {
    expect(CheckResponseSchema.safeParse({ status: 'inventado' }).success).toBe(false);
  });
});
