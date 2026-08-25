import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { mockSteamInstallPath } from './library-scanner.test-helpers.js';

vi.mock('../../platform/steam-registry.js');

describe('scanSteamLibrary — biblioteca principal', () => {
  let steamRoot: string;

  beforeEach(() => {
    steamRoot = mkdtempSync(join(tmpdir(), 'ycore-steam-test-'));
    mkdirSync(join(steamRoot, 'steamapps'), { recursive: true });
  });

  afterEach(() => {
    rmSync(steamRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it('devuelve AppError not-found si Steam no está instalado', async () => {
    const { findSteamInstallPath } = await import('../../platform/steam-registry.js');
    vi.mocked(findSteamInstallPath).mockResolvedValue({
      ok: false,
      error: { code: 'not-found', retriable: false },
    });

    const { scanSteamLibrary } = await import('./library-scanner.js');
    const result = await scanSteamLibrary();

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('devuelve un array vacío si Steam está instalado pero sin juegos', async () => {
    await mockSteamInstallPath(steamRoot);

    const { scanSteamLibrary } = await import('./library-scanner.js');
    const result = await scanSteamLibrary();

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual([]);
  });

});
