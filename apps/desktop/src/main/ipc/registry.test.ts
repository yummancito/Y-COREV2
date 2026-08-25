import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { contract } from '@ycore/ipc-contract';
import { openDatabase, games, type YCoreDatabase } from '../db/index.js';
import { MIGRATIONS_FOLDER } from '../db/test-helpers.js';
import { buildRegistry, type Registry } from './registry.js';

describe('buildRegistry', () => {
  let db: YCoreDatabase;
  let registry: Registry;

  beforeEach(() => {
    db = openDatabase(':memory:', MIGRATIONS_FOLDER);
    registry = buildRegistry(db);
  });

  afterEach(() => {
    db.$client.close();
  });

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
      expect(Number.isNaN(new Date(result.value.receivedAt).getTime())).toBe(false);
    }
  });

  it('library.list devuelve la biblioteca desde la DB real', async () => {
    db.insert(games).values({ appId: 730, name: 'Counter-Strike 2' }).run();

    const result = await registry['library.list']({});

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.games).toEqual([
        { appId: 730, name: 'Counter-Strike 2', installation: null },
      ]);
    }
  });

  it('library.launch de un juego que no existe devuelve AppError not-found', async () => {
    const result = await registry['library.launch']({ appId: 999999 });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });
});
