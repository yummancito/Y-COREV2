import { describe, expect, it, vi } from 'vitest';
import { isOk, ok } from '@ycore/result';
import { createDownloadHandlers } from './handlers.js';
import type { DownloadService } from './service.js';

function fakeService(overrides: Partial<Record<keyof DownloadService, unknown>> = {}): DownloadService {
  return {
    list: vi.fn().mockReturnValue([]),
    enqueue: vi.fn().mockReturnValue(ok({ id: 'd1' })),
    pause: vi.fn().mockReturnValue(ok(undefined)),
    cancel: vi.fn().mockResolvedValue(ok(undefined)),
    ...overrides,
  } as unknown as DownloadService;
}

describe('createDownloadHandlers', () => {
  it('list delega en el servicio y traduce cada DownloadRecord a la forma del contrato', async () => {
    const list = vi.fn().mockReturnValue([{ state: { id: 'd1', status: 'queued' }, metadata: { appId: 730 } }]);
    const handlers = createDownloadHandlers(fakeService({ list }));

    const result = await handlers.list();

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ downloads: [{ state: { id: 'd1', status: 'queued' }, appId: 730 }] });
    }
    expect(list).toHaveBeenCalledOnce();
  });

  it('enqueue delega en el servicio con el input traducido', async () => {
    const enqueue = vi.fn().mockReturnValue(ok({ id: 'd1' }));
    const handlers = createDownloadHandlers(fakeService({ enqueue }));

    const result = await handlers.enqueue({
      appId: 730,
      sourceUrl: 'https://example.invalid/cs2.zip',
      installPath: 'C:\\Steam\\cs2',
      expectedSha256: 'a'.repeat(64),
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual({ id: 'd1' });
    expect(enqueue).toHaveBeenCalledWith({
      appId: 730,
      sourceUrl: 'https://example.invalid/cs2.zip',
      installPath: 'C:\\Steam\\cs2',
      expectedSha256: 'a'.repeat(64),
    });
  });

  it('pause delega en el servicio y devuelve un objeto vacío', async () => {
    const pause = vi.fn().mockReturnValue(ok(undefined));
    const handlers = createDownloadHandlers(fakeService({ pause }));

    const result = await handlers.pause({ id: 'd1' });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual({});
    expect(pause).toHaveBeenCalledWith('d1');
  });

  it('cancel delega en el servicio (async) y devuelve un objeto vacío', async () => {
    const cancel = vi.fn().mockResolvedValue(ok(undefined));
    const handlers = createDownloadHandlers(fakeService({ cancel }));

    const result = await handlers.cancel({ id: 'd1' });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual({});
    expect(cancel).toHaveBeenCalledWith('d1');
  });
});
