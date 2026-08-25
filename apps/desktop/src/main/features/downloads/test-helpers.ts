/**
 * Helper compartido por los tests de `main/features/downloads` — abre una DB
 * SQLite en memoria real (no mockeada) con el esquema migrado, y arma
 * metadatos de descarga de ejemplo, para probar el repositorio y el servicio
 * contra Drizzle de verdad.
 */

import { openDatabase, type YCoreDatabase } from '../../db/index.js';
import { MIGRATIONS_FOLDER } from '../../db/test-helpers.js';
import type { DownloadMetadata } from './download-record.js';

/** Abre una DB SQLite en memoria con las migraciones aplicadas. Ciérrala con `$client.close()`. */
export function openInMemoryDb(): YCoreDatabase {
  return openDatabase(':memory:', MIGRATIONS_FOLDER);
}

/** Metadatos de descarga de ejemplo, con overrides opcionales. */
export function fakeMetadata(overrides: Partial<DownloadMetadata> = {}): DownloadMetadata {
  return {
    appId: 730,
    sourceUrl: 'https://example.invalid/cs2.zip',
    destinationPath: 'C:\\Downloads\\cs2.zip',
    installPath: 'C:\\Steam\\steamapps\\common\\cs2',
    expectedSha256: 'a'.repeat(64),
    etag: null,
    lastModified: null,
    segmentIndex: 0,
    segmentCount: 1,
    retryCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
