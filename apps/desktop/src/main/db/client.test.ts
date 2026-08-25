import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultDbPath, openDatabase } from './client.js';
import { games } from './schema.js';
import { cleanupTempDir, createTempDir, MIGRATIONS_FOLDER } from './test-helpers.js';

describe('openDatabase — criterio de HECHO de Fase 1 (migración aplicable)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it('crea el archivo de DB y aplica la migración: la tabla games queda usable', () => {
    const dbPath = defaultDbPath(tmpDir);
    const db = openDatabase(dbPath, MIGRATIONS_FOLDER);

    expect(existsSync(dbPath)).toBe(true);

    db.insert(games).values({ appId: 730, name: 'Counter-Strike 2' }).run();
    const rows = db.select().from(games).all();

    expect(rows).toEqual([
      {
        appId: 730,
        name: 'Counter-Strike 2',
        installationPath: null,
        executablePath: null,
        sizeOnDiskBytes: null,
        lastPlayedAt: null,
      },
    ]);

    db.$client.close();
  });

  it('reabrir la misma DB no reaplica la migración ni pierde datos (idempotente)', () => {
    const dbPath = defaultDbPath(tmpDir);

    const db1 = openDatabase(dbPath, MIGRATIONS_FOLDER);
    db1.insert(games).values({ appId: 70, name: 'Half-Life' }).run();
    db1.$client.close();

    const db2 = openDatabase(dbPath, MIGRATIONS_FOLDER);
    const rows = db2.select().from(games).all();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Half-Life');

    db2.$client.close();
  });
});

describe('defaultDbPath', () => {
  it('construye la ruta del archivo dentro del directorio dado', () => {
    expect(defaultDbPath('C:\\Users\\alguien\\AppData\\Roaming\\Y-CORE')).toBe(
      'C:\\Users\\alguien\\AppData\\Roaming\\Y-CORE\\y-core.sqlite',
    );
  });
});
