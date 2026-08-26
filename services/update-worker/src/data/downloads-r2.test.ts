import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { fetchReleaseObject } from './downloads-r2.js';

const KEY = 'releases/5.1.0/Setup.exe';
const CONTENT = 'contenido de prueba del instalador';

describe('downloads-r2', () => {
  beforeEach(async () => {
    await env.RELEASES.put(KEY, CONTENT);
  });

  it('devuelve el objeto completo sin Range', async () => {
    const result = await fetchReleaseObject(env.RELEASES, KEY, null);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.size).toBe(CONTENT.length);
      expect(result.value.requestedRange).toBeUndefined();
    }
  });

  it('devuelve not-found si la clave no existe', async () => {
    const result = await fetchReleaseObject(env.RELEASES, 'releases/no-existe.exe', null);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('respeta un Range parcial', async () => {
    const result = await fetchReleaseObject(env.RELEASES, KEY, 'bytes=5-10');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.requestedRange).toBeDefined();
  });

  it('ignora un Range con formato inválido y sirve el objeto completo', async () => {
    const result = await fetchReleaseObject(env.RELEASES, KEY, 'esto-no-es-un-range-valido');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.requestedRange).toBeUndefined();
  });
});
