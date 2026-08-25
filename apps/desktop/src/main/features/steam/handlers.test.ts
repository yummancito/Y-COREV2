import { describe, expect, it, vi } from 'vitest';
import { isOk, ok } from '@ycore/result';
import { createSteamHandlers } from './handlers.js';
import type { SteamService } from './service.js';

describe('createSteamHandlers', () => {
  it('importLibrary delega en el servicio y devuelve su resultado tal cual', async () => {
    const importLibrary = vi.fn().mockResolvedValue(ok({ gamesFound: 3 }));
    const fakeService = { importLibrary } as unknown as SteamService;
    const handlers = createSteamHandlers(fakeService);

    const result = await handlers.importLibrary();

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual({ gamesFound: 3 });
    expect(importLibrary).toHaveBeenCalledOnce();
  });
});
