import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type YCoreDatabase } from '../../db/index.js';
import { MIGRATIONS_FOLDER } from '../../db/test-helpers.js';
import { ClientIdRepository } from './client-id-repository.js';

describe('ClientIdRepository', () => {
  let db: YCoreDatabase;

  beforeEach(() => {
    db = openDatabase(':memory:', MIGRATIONS_FOLDER);
  });

  afterEach(() => {
    db.$client.close();
  });

  it('genera un UUID v4 la primera vez', () => {
    const repository = new ClientIdRepository(db);

    const clientId = repository.getOrCreate();

    expect(clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('devuelve el mismo clientId en llamadas sucesivas (estable entre arranques)', () => {
    const repository = new ClientIdRepository(db);

    const first = repository.getOrCreate();
    const second = repository.getOrCreate();

    expect(second).toBe(first);
  });

  it('sobrevive a reabrir el repositorio (nueva instancia, misma DB)', () => {
    const first = new ClientIdRepository(db).getOrCreate();

    const second = new ClientIdRepository(db).getOrCreate();

    expect(second).toBe(first);
  });
});
