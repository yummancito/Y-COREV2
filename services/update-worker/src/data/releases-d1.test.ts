import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { isOk } from '@ycore/result';
import { findLatestRelease, insertRelease, yankRelease } from './releases-d1.js';
import { applyMigrations } from '../test-migrations.js';

const sampleRelease = {
  version: '5.1.0',
  channel: 'stable',
  r2Key: 'releases/5.1.0/Setup.exe',
  manifestKey: 'releases/5.1.0/manifest.json',
  blockmapKey: null,
  size: 98123456,
  sha512: 'a'.repeat(128),
  blockmapSha512: null,
  estimatedDeltaSize: null,
  notes: { es: 'notas', en: 'notes' },
  mandatory: false,
  publishedAt: '2026-01-01T00:00:00.000Z',
};

describe('releases-d1', () => {
  beforeEach(async () => {
    await applyMigrations();
    // El schema de esta versión de vitest-pool-workers no aísla el storage
    // entre tests del mismo archivo (ver vitest.config.ts): se limpia a mano.
    await env.DB.prepare('DELETE FROM releases').run();
  });

  it('findLatestRelease devuelve null si no hay ninguna release en el canal', async () => {
    const result = await findLatestRelease(env.DB, 'stable');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBeNull();
  });

  it('insertRelease guarda la fila y findLatestRelease la devuelve', async () => {
    await insertRelease(env.DB, sampleRelease);

    const result = await findLatestRelease(env.DB, 'stable');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ ...sampleRelease, yanked: false });
    }
  });

  it('findLatestRelease ignora una release yanked', async () => {
    await insertRelease(env.DB, sampleRelease);
    await yankRelease(env.DB, '5.1.0');

    const result = await findLatestRelease(env.DB, 'stable');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBeNull();
  });

  it('findLatestRelease devuelve la más reciente entre varias', async () => {
    await insertRelease(env.DB, sampleRelease);
    await insertRelease(env.DB, { ...sampleRelease, version: '5.2.0', publishedAt: '2026-02-01T00:00:00.000Z' });

    const result = await findLatestRelease(env.DB, 'stable');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value?.version).toBe('5.2.0');
  });
});
