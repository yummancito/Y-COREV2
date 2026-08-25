import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { needsRepair, parseAppManifest } from './app-manifest.js';
import type { AppManifest } from './app-manifest.js';

const REAL_ACF = `
  "AppState"
  {
    "appid"		"730"
    "Universe"		"1"
    "name"		"Counter-Strike 2"
    "StateFlags"		"4"
    "installdir"		"Counter-Strike Global Offensive"
    "LastUpdated"		"1700000000"
    "SizeOnDisk"		"41943040000"
    "buildid"		"12345678"
    "LastPlayed"		"1700086400"
    "InstalledDepots"
    {
      "731"
      {
        "manifest"		"9876543210987654321"
      }
    }
    "UserConfig"
    {
      "Language"		"english"
    }
  }
`;

describe('parseAppManifest — caso feliz', () => {
  it('extrae todos los campos de un ACF real', () => {
    const result = parseAppManifest(REAL_ACF);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({
        appId: '730',
        name: 'Counter-Strike 2',
        installDir: 'Counter-Strike Global Offensive',
        stateFlags: 4,
        sizeOnDiskBytes: 41943040000,
        lastUpdatedAtSeconds: 1700000000,
        lastPlayedAtSeconds: 1700086400,
        buildId: '12345678',
      });
    }
  });

  it('usa valores por defecto sensatos si faltan campos opcionales', () => {
    const result = parseAppManifest('"AppState"\n{\n\t"appid" "730"\n}');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.name).toBe('');
      expect(result.value.stateFlags).toBe(0);
      expect(result.value.sizeOnDiskBytes).toBe(0);
    }
  });
});

describe('parseAppManifest — ACF corrupto', () => {
  it('devuelve AppError not-found si falta la sección AppState', () => {
    const result = parseAppManifest('"OtraCosa"\n{\n\t"x" "y"\n}');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('devuelve AppError not-found si AppState no tiene appid', () => {
    const result = parseAppManifest('"AppState"\n{\n\t"name" "Sin AppID"\n}');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('propaga AppError io.failed si el VDF es sintácticamente inválido', () => {
    const result = parseAppManifest('"AppState"\n{\n\t"appid"');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('io.failed');
  });
});

describe('needsRepair — heurística de instalación interrumpida (v1: shouldRepairAcf)', () => {
  const base: AppManifest = {
    appId: '730',
    name: 'Counter-Strike 2',
    installDir: 'cs2',
    stateFlags: 4,
    sizeOnDiskBytes: 0,
    lastUpdatedAtSeconds: 0,
    lastPlayedAtSeconds: 0,
    buildId: '1',
  };

  it('StateFlags=4 con SizeOnDisk=0 necesita reparación', () => {
    expect(needsRepair(base)).toBe(true);
  });

  it('StateFlags=36 con SizeOnDisk=0 necesita reparación', () => {
    expect(needsRepair({ ...base, stateFlags: 36 })).toBe(true);
  });

  it('StateFlags=4 con SizeOnDisk>0 NO necesita reparación (instalación completa normal)', () => {
    expect(needsRepair({ ...base, sizeOnDiskBytes: 41943040000 })).toBe(false);
  });

  it('StateFlags=4 (instalado y listo) con SizeOnDisk>0 NO necesita reparación', () => {
    expect(needsRepair({ ...base, stateFlags: 4, sizeOnDiskBytes: 100 })).toBe(false);
  });

  it('cualquier otro StateFlags NO necesita reparación aunque SizeOnDisk sea 0', () => {
    expect(needsRepair({ ...base, stateFlags: 1, sizeOnDiskBytes: 0 })).toBe(false);
  });
});
