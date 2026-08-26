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

describe('decideCheckResponse — modo mantenimiento (corazón del ADR-0003)', () => {
  it('con mantenimiento activo, un cliente atrasado recibe EXACTAMENTE la misma respuesta que uno al día', async () => {
    const upToDateClient = await decideCheckResponse(baseInput({ clientVersion: '5.1.0' }), SECRET, NOW);

    const maintenanceConfig: YCoreConfig = { ...baseConfig, maintenance: { enabled: true, since: null, note: 'x' } };
    const outdatedClientDuringMaintenance = await decideCheckResponse(
      baseInput({ clientVersion: '5.0.0', config: maintenanceConfig }),
      SECRET,
      NOW,
    );

    expect(outdatedClientDuringMaintenance).toEqual(upToDateClient);
  });

  it('desactivar el mantenimiento hace que el update vuelva a aparecer', async () => {
    const maintenanceConfig: YCoreConfig = { ...baseConfig, maintenance: { enabled: true, since: null, note: 'x' } };
    const duringMaintenance = await decideCheckResponse(baseInput({ config: maintenanceConfig }), SECRET, NOW);
    expect(duringMaintenance.status).toBe('up-to-date');

    const afterMaintenance = await decideCheckResponse(baseInput({ config: baseConfig }), SECRET, NOW);
    expect(afterMaintenance.status).toBe('update-available');
  });
});

describe('decideCheckResponse — kill-switch', () => {
  it('una versión bloqueada recibe status blocked con forceUpdateTo', async () => {
    const configWithBlock: YCoreConfig = {
      ...baseConfig,
      blocked: { '5.0.0': { reason: 'critical-bug', forceTo: '5.1.0' } },
    };

    const response = await decideCheckResponse(
      baseInput({ clientVersion: '5.0.0', config: configWithBlock }),
      SECRET,
      NOW,
    );

    expect(response).toMatchObject({ status: 'blocked', forceUpdateTo: '5.1.0' });
  });

  it('el bloqueo pesa más que el mantenimiento: un cliente bloqueado ve blocked aunque haya mantenimiento activo', async () => {
    const configWithBoth: YCoreConfig = {
      ...baseConfig,
      maintenance: { enabled: true, since: null, note: 'x' },
      blocked: { '5.0.0': { reason: 'critical-bug', forceTo: '5.1.0' } },
    };

    const response = await decideCheckResponse(
      baseInput({ clientVersion: '5.0.0', config: configWithBoth }),
      SECRET,
      NOW,
    );

    expect(response.status).toBe('blocked');
  });
});
