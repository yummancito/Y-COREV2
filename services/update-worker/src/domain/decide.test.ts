import { describe, expect, it } from 'vitest';
import { decideCheckResponse, type DecideInput } from './decide.js';
import type { YCoreConfig } from './config.js';
import type { ReleaseRecord } from './release-record.js';

const SECRET = 'test-secret';
const NOW = 1_000_000;

const baseConfig: YCoreConfig = {
  maintenance: { enabled: false, since: null, note: '' },
  channels: { stable: { latest: '5.1.0', rollout: 100, minSupported: '4.0.0' } },
  blocked: {},
  checkIntervalSeconds: 21600,
};

const baseRelease: ReleaseRecord = {
  version: '5.1.0',
  channel: 'stable',
  r2Key: 'releases/5.1.0/Setup.exe',
  blockmapKey: null,
  size: 98123456,
  sha512: 'a'.repeat(128),
  blockmapSha512: null,
  estimatedDeltaSize: null,
  notes: { es: 'notas', en: 'notes' },
  mandatory: false,
  publishedAt: '2026-01-01T00:00:00.000Z',
  yanked: false,
};

function baseInput(overrides: Partial<DecideInput> = {}): DecideInput {
  return {
    clientVersion: '5.0.0',
    channel: 'stable',
    clientId: '11111111-1111-4111-8111-111111111111',
    config: baseConfig,
    latestRelease: baseRelease,
    ...overrides,
  };
}

describe('decideCheckResponse — caso feliz', () => {
  it('un cliente en una versión vieja, con rollout 100, recibe update-available', async () => {
    const response = await decideCheckResponse(baseInput(), SECRET, NOW);

    expect(response.status).toBe('update-available');
    if (response.status === 'update-available') {
      expect(response.version).toBe('5.1.0');
      expect(response.artifact.url).toContain('/v1/download/5.1.0/full');
    }
  });

  it('un cliente ya en la última versión recibe up-to-date', async () => {
    const response = await decideCheckResponse(baseInput({ clientVersion: '5.1.0' }), SECRET, NOW);

    expect(response).toEqual({ status: 'up-to-date', checkAgainInSeconds: 21600 });
  });

  it('un canal desconocido recibe up-to-date', async () => {
    const response = await decideCheckResponse(baseInput({ channel: 'nightly' }), SECRET, NOW);

    expect(response.status).toBe('up-to-date');
  });

  it('sin ninguna release publicada, recibe up-to-date', async () => {
    const response = await decideCheckResponse(baseInput({ latestRelease: null }), SECRET, NOW);

    expect(response.status).toBe('up-to-date');
  });

  it('una release yanked no se ofrece', async () => {
    const response = await decideCheckResponse(
      baseInput({ latestRelease: { ...baseRelease, yanked: true } }),
      SECRET,
      NOW,
    );

    expect(response.status).toBe('up-to-date');
  });
});
