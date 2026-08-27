import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS, SETTINGS_SCHEMA_VERSION } from '@ycore/core-domain';
import { openDatabase, settings, type YCoreDatabase } from '../../db/index.js';
import { MIGRATIONS_FOLDER } from '../../db/test-helpers.js';
import { SettingsRepository } from './repository.js';

describe('SettingsRepository', () => {
  let db: YCoreDatabase;

  beforeEach(() => {
    db = openDatabase(':memory:', MIGRATIONS_FOLDER);
  });

  afterEach(() => {
    db.$client.close();
  });

  it('read() devuelve los defaults si es el primer arranque', () => {
    const repository = new SettingsRepository(db);

    expect(repository.read()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('write() y read() redondean el mismo valor', () => {
    const repository = new SettingsRepository(db);
    const value = { ...DEFAULT_APP_SETTINGS, language: 'es', updateChannel: 'beta' as const };

    repository.write(value);

    expect(repository.read()).toEqual(value);
  });

  it('write() sobre un valor ya existente lo actualiza, no lo duplica', () => {
    const repository = new SettingsRepository(db);

    repository.write({ ...DEFAULT_APP_SETTINGS, language: 'es' });
    repository.write({ ...DEFAULT_APP_SETTINGS, language: 'en' });

    expect(repository.read().language).toBe('en');
  });

  it('read() devuelve los defaults si el JSON guardado está corrupto', () => {
    db.insert(settings).values({ key: 'appSettings', value: 'esto no es json' }).run();
    const repository = new SettingsRepository(db);

    expect(repository.read()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('read() migra un valor guardado con la versión de esquema vigente', () => {
    db.insert(settings)
      .values({ key: 'appSettings', value: JSON.stringify({ schemaVersion: SETTINGS_SCHEMA_VERSION, language: 'fr' }) })
      .run();
    const repository = new SettingsRepository(db);

    expect(repository.read()).toEqual({ ...DEFAULT_APP_SETTINGS, language: 'fr' });
  });
});
