import { copyFileSync, existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultDbPath, openDatabase } from './client.js';
import { games } from './schema.js';
import { cleanupTempDir, createTempDir, MIGRATIONS_FOLDER } from './test-helpers.js';

describe('openDatabase — backup automático y reversión (criterio de HECHO de Fase 1)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it('hace backup del archivo existente antes de volver a migrar', () => {
    const dbPath = defaultDbPath(tmpDir);
    openDatabase(dbPath, MIGRATIONS_FOLDER).$client.close();
    const db = openDatabase(dbPath, MIGRATIONS_FOLDER);

    expect(existsSync(`${dbPath}.bak`)).toBe(true);

    db.$client.close();
  });

  it('el backup permite revertir: restaurarlo deja la DB como antes de la última apertura', () => {
    // drizzle-kit no genera "down migrations" para SQLite (limitación real de la
    // herramienta, no de este código) — el mecanismo de reversión de Y-CORE es
    // restaurar el backup automático que hace openDatabase() antes de migrar.
    const dbPath = defaultDbPath(tmpDir);

    const db1 = openDatabase(dbPath, MIGRATIONS_FOLDER);
    db1.insert(games).values({ appId: 70, name: 'Half-Life' }).run();
    db1.$client.close();

    const db2 = openDatabase(dbPath, MIGRATIONS_FOLDER);
    db2.insert(games).values({ appId: 730, name: 'Counter-Strike 2' }).run();
    db2.$client.close();

    // Revertir: restaurar el .bak que se hizo al abrir db2 (contiene solo Half-Life).
    copyFileSync(`${dbPath}.bak`, dbPath);

    const dbRestaurada = openDatabase(dbPath, MIGRATIONS_FOLDER);
    const rows = dbRestaurada.select().from(games).all();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Half-Life');

    dbRestaurada.$client.close();
  });
});
