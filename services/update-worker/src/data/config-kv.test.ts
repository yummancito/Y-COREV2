import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { readYCoreConfig, writeMaintenanceFlag } from './config-kv.js';

const SAMPLE_CONFIG = {
  maintenance: { enabled: false, since: null, note: '' },
  channels: { stable: { latest: '5.1.0', rollout: 100, minSupported: '4.0.0' } },
  blocked: {},
  checkIntervalSeconds: 21600,
};

describe('config-kv', () => {
  beforeEach(async () => {
    await env.CONFIG.put('YCORE_CONFIG', JSON.stringify(SAMPLE_CONFIG));
  });

  afterEach(async () => {
    await env.CONFIG.delete('YCORE_CONFIG');
  });

  it('readYCoreConfig lee y valida el config real de KV', async () => {
    const result = await readYCoreConfig(env.CONFIG);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual(SAMPLE_CONFIG);
  });

  it('readYCoreConfig devuelve not-found si la clave no existe', async () => {
    await env.CONFIG.delete('YCORE_CONFIG');

    const result = await readYCoreConfig(env.CONFIG);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('readYCoreConfig devuelve unknown si el JSON no tiene la forma esperada', async () => {
    await env.CONFIG.put('YCORE_CONFIG', JSON.stringify({ maintenance: 'no-es-un-objeto' }));

    const result = await readYCoreConfig(env.CONFIG);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('unknown');
  });

  it('writeMaintenanceFlag activa el mantenimiento sin tocar el resto del config', async () => {
    const written = await writeMaintenanceFlag(env.CONFIG, true, 'migrando R2', '2026-01-01T00:00:00.000Z');
    expect(isOk(written)).toBe(true);

    const read = await readYCoreConfig(env.CONFIG);
    expect(isOk(read)).toBe(true);
    if (isOk(read)) {
      expect(read.value.maintenance).toEqual({ enabled: true, since: '2026-01-01T00:00:00.000Z', note: 'migrando R2' });
      expect(read.value.channels).toEqual(SAMPLE_CONFIG.channels);
    }
  });

  it('writeMaintenanceFlag desactiva el mantenimiento y limpia since', async () => {
    await writeMaintenanceFlag(env.CONFIG, true, 'x', '2026-01-01T00:00:00.000Z');

    await writeMaintenanceFlag(env.CONFIG, false, 'y', '2026-01-02T00:00:00.000Z');

    const read = await readYCoreConfig(env.CONFIG);
    expect(isOk(read)).toBe(true);
    if (isOk(read)) expect(read.value.maintenance).toEqual({ enabled: false, since: null, note: 'y' });
  });
});
