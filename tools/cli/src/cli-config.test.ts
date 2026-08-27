import { describe, expect, it } from 'vitest';
import { readCliConfig } from './cli-config.js';

describe('readCliConfig', () => {
  it('lee baseUrl y adminToken del entorno dado', () => {
    const config = readCliConfig({ YCORE_WORKER_URL: 'https://updates.y-core.app', YCORE_ADMIN_TOKEN: 'secret' });

    expect(config).toEqual({ baseUrl: 'https://updates.y-core.app', adminToken: 'secret' });
  });

  it('lanza si falta YCORE_WORKER_URL', () => {
    expect(() => readCliConfig({ YCORE_ADMIN_TOKEN: 'secret' })).toThrow('YCORE_WORKER_URL');
  });

  it('lanza si falta YCORE_ADMIN_TOKEN', () => {
    expect(() => readCliConfig({ YCORE_WORKER_URL: 'https://updates.y-core.app' })).toThrow('YCORE_ADMIN_TOKEN');
  });
});
