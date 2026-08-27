import { describe, expect, it, vi } from 'vitest';
import { createUpdateHandlers } from './handlers.js';
import type { UpdateService, UpdateStatus } from './service.js';

function fakeService(status: UpdateStatus, installNow: (onBeforeQuit: () => void) => void = () => {}): UpdateService {
  return { getStatus: () => status, installNow } as unknown as UpdateService;
}

describe('createUpdateHandlers', () => {
  it('getStatus devuelve el estado tal cual lo reporta el servicio', async () => {
    const handlers = createUpdateHandlers(fakeService({ phase: 'up-to-date' }), () => {});

    const result = await handlers.getStatus();

    expect(result).toEqual({ ok: true, value: { status: { phase: 'up-to-date' } } });
  });

  it('installNow delega en el servicio con el callback de cierre', async () => {
    const onBeforeQuit = vi.fn();
    const installNow = vi.fn();
    const handlers = createUpdateHandlers(fakeService({ phase: 'up-to-date' }, installNow), onBeforeQuit);

    const result = await handlers.installNow();

    expect(installNow).toHaveBeenCalledWith(onBeforeQuit);
    expect(result).toEqual({ ok: true, value: {} });
  });
});
