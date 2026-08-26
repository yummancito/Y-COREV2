import { describe, expect, it } from 'vitest';
import { decideCheckResponse, type DecideInput } from './decide.js';
import type { YCoreConfig } from './config.js';
import type { ReleaseRecord } from './release-record.js';

const SECRET = 'test-secret';
const NOW = 1_000_000;

const baseConfig: YCoreConfig = {
  maintenance: { enabled: false, since: null, note: '' },
  channels: { stable: { latest: '5.1.0', rollout: 0, minSupported: '4.0.0' } },
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

describe('decideCheckResponse — rollout parcial', () => {
  it('con rollout 0, un cliente fuera del reparto recibe up-to-date', async () => {
    const response = await decideCheckResponse(baseInput(), SECRET, NOW);

    expect(response.status).toBe('up-to-date');
  });

  it('con rollout 100, cualquier cliente recibe update-available', async () => {
    const config: YCoreConfig = { ...baseConfig, channels: { stable: { ...baseConfig.channels['stable']!, rollout: 100 } } };

    const response = await decideCheckResponse(baseInput({ config }), SECRET, NOW);

    expect(response.status).toBe('update-available');
  });
});

describe('decideCheckResponse — descarga diferencial', () => {
  it('sin blockmapKey, delta es null', async () => {
    const config: YCoreConfig = { ...baseConfig, channels: { stable: { ...baseConfig.channels['stable']!, rollout: 100 } } };

    const response = await decideCheckResponse(baseInput({ config }), SECRET, NOW);

    expect(response.status).toBe('update-available');
    if (response.status === 'update-available') expect(response.delta).toBeNull();
  });

  it('con blockmapKey, delta trae una URL firmada y el tamaño estimado', async () => {
    const config: YCoreConfig = { ...baseConfig, channels: { stable: { ...baseConfig.channels['stable']!, rollout: 100 } } };
    const releaseWithDelta: ReleaseRecord = {
      ...baseRelease,
      blockmapKey: 'releases/5.1.0/Setup.exe.blockmap',
      estimatedDeltaSize: 14_200_000,
    };

    const response = await decideCheckResponse(baseInput({ config, latestRelease: releaseWithDelta }), SECRET, NOW);

    expect(response.status).toBe('update-available');
    if (response.status === 'update-available') {
      expect(response.delta).not.toBeNull();
      expect(response.delta?.blockmapUrl).toContain('/v1/download/5.1.0/blockmap');
      expect(response.delta?.estimatedSize).toBe(14_200_000);
    }
  });
});
