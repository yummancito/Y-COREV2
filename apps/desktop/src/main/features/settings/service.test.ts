import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '@ycore/core-domain';
import { openDatabase, type YCoreDatabase } from '../../db/index.js';
import { MIGRATIONS_FOLDER } from '../../db/test-helpers.js';
import { SettingsRepository } from './repository.js';
import { SettingsService } from './service.js';

describe('SettingsService', () => {
  let db: YCoreDatabase;
  let service: SettingsService;

  beforeEach(() => {
    db = openDatabase(':memory:', MIGRATIONS_FOLDER);
    service = new SettingsService(new SettingsRepository(db));
  });

  afterEach(() => {
    db.$client.close();
  });

  it('read() devuelve los defaults en el primer arranque', () => {
    expect(service.read()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('update() fusiona el parche con lo ya guardado, sin tocar el resto', () => {
    service.update({ language: 'es' });

    const result = service.update({ closeToTray: true });

    expect(result).toEqual({ ...DEFAULT_APP_SETTINGS, language: 'es', closeToTray: true });
  });

  it('update() persiste: una instancia nueva del servicio ve el cambio', () => {
    service.update({ updateChannel: 'beta' });

    const fresh = new SettingsService(new SettingsRepository(db));

    expect(fresh.read().updateChannel).toBe('beta');
  });

  it('update() con un campo undefined explícito no borra el valor ya guardado', () => {
    service.update({ language: 'es' });

    const result = service.update({ language: undefined, closeToTray: true });

    expect(result.language).toBe('es');
    expect(result.closeToTray).toBe(true);
  });
});
