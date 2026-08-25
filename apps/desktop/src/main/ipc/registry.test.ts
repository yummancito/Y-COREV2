import { describe, expect, it } from 'vitest';
import { isOk } from '@ycore/result';
import { contract } from '@ycore/ipc-contract';
import { registry } from './registry.js';

describe('registry', () => {
  it('cubre el 100% de los canales declarados en el contrato', () => {
    const contractChannels = Object.keys(contract).sort();
    const registryChannels = Object.keys(registry).sort();
    expect(registryChannels).toEqual(contractChannels);
  });

  it('app.ping devuelve pong: true y un receivedAt válido', async () => {
    const result = await registry['app.ping']({});

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.pong).toBe(true);
      expect(() => new Date(result.value.receivedAt)).not.toThrow();
      expect(Number.isNaN(new Date(result.value.receivedAt).getTime())).toBe(false);
    }
  });
});
