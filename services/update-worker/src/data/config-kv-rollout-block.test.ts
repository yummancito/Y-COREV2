import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { readYCoreConfig, writeChannelRollout, writeBlockedVersion } from './config-kv.js';

const SAMPLE_CONFIG = {
  maintenance: { enabled: false, since: null, note: '' },
  channels: { stable: { latest: '5.1.0', rollout: 100, minSupported: '4.0.0' } },
  blocked: {},
  checkIntervalSeconds: 21600,
};

describe('config-kv — writeChannelRollout y writeBlockedVersion', () => {
  beforeEach(async () => {
    await env.CONFIG.put('YCORE_CONFIG', JSON.stringify(SAMPLE_CONFIG));
  });

  afterEach(async () => {
    await env.CONFIG.delete('YCORE_CONFIG');
  });

  it('writeChannelRollout cambia el rollout de un canal existente sin tocar latest', async () => {
    const written = await writeChannelRollout(env.CONFIG, 'stable', 50);
    expect(isOk(written)).toBe(true);

    const read = await readYCoreConfig(env.CONFIG);
    expect(isOk(read)).toBe(true);
    if (isOk(read)) expect(read.value.channels['stable']).toEqual({ latest: '5.1.0', rollout: 50, minSupported: '4.0.0' });
  });

  it('writeChannelRollout devuelve not-found si el canal no existe todavía', async () => {
    const written = await writeChannelRollout(env.CONFIG, 'beta', 50);

    expect(isErr(written)).toBe(true);
    if (isErr(written)) expect(written.error.code).toBe('not-found');
  });

  it('writeBlockedVersion añade una versión bloqueada sin tocar el resto del config', async () => {
    const written = await writeBlockedVersion(env.CONFIG, '5.0.9', 'corrompe la DB local', '5.1.0');
    expect(isOk(written)).toBe(true);

    const read = await readYCoreConfig(env.CONFIG);
    expect(isOk(read)).toBe(true);
    if (isOk(read)) {
      expect(read.value.blocked['5.0.9']).toEqual({ reason: 'corrompe la DB local', forceTo: '5.1.0' });
      expect(read.value.channels).toEqual(SAMPLE_CONFIG.channels);
    }
  });
});
