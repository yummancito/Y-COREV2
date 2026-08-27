import { describe, expect, it } from 'vitest';
import { migrateSettings, DEFAULT_APP_SETTINGS, SETTINGS_SCHEMA_VERSION } from './app-settings.js';

describe('migrateSettings', () => {
  it('devuelve los defaults si no hay nada guardado (undefined)', () => {
    expect(migrateSettings(undefined)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('devuelve los defaults si lo guardado no es un objeto', () => {
    expect(migrateSettings('no-es-un-objeto')).toEqual(DEFAULT_APP_SETTINGS);
    expect(migrateSettings(null)).toEqual(DEFAULT_APP_SETTINGS);
    expect(migrateSettings(42)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('devuelve los defaults si la versión de esquema es desconocida', () => {
    expect(migrateSettings({ schemaVersion: 999, language: 'es' })).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('conserva los valores guardados en la versión actual del esquema', () => {
    const stored = {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      language: 'es',
      updateChannel: 'beta',
      maxDownloadBytesPerSecond: 1_000_000,
      discordRichPresenceEnabled: false,
      closeToTray: true,
    };

    expect(migrateSettings(stored)).toEqual(stored);
  });

  it('rellena con defaults cualquier campo que falte en la versión actual', () => {
    const stored = { schemaVersion: SETTINGS_SCHEMA_VERSION, language: 'en' };

    expect(migrateSettings(stored)).toEqual({ ...DEFAULT_APP_SETTINGS, language: 'en' });
  });
});
