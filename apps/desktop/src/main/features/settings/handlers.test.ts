import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '@ycore/core-domain';
import { createSettingsHandlers } from './handlers.js';
import type { SettingsService } from './service.js';

function fakeService(read: () => typeof DEFAULT_APP_SETTINGS, update = vi.fn()): SettingsService {
  return { read, update } as unknown as SettingsService;
}

describe('createSettingsHandlers', () => {
  it('get devuelve los settings tal cual los reporta el servicio', async () => {
    const handlers = createSettingsHandlers(fakeService(() => DEFAULT_APP_SETTINGS));

    const result = await handlers.get();

    expect(result).toEqual({ ok: true, value: { settings: DEFAULT_APP_SETTINGS } });
  });

  it('update delega el patch en el servicio y devuelve el resultado', async () => {
    const updated = { ...DEFAULT_APP_SETTINGS, language: 'es' };
    const update = vi.fn().mockReturnValue(updated);
    const handlers = createSettingsHandlers(fakeService(() => DEFAULT_APP_SETTINGS, update));

    const result = await handlers.update({ settings: { language: 'es' } });

    expect(update).toHaveBeenCalledWith({ language: 'es' });
    expect(result).toEqual({ ok: true, value: { settings: updated } });
  });
});
