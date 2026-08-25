import { describe, expect, it, vi } from 'vitest';
import { ok } from '@ycore/result';
import { isErr } from '@ycore/result';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('@ycore/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() }),
}));
vi.mock('./registry.js', () => ({
  registry: {
    'app.ping': vi.fn(() => Promise.resolve(ok({ pong: false, receivedAt: 'no-es-una-fecha-iso' }))),
  },
}));

describe('handleIpcRequest — output que no valida contra el contrato', () => {
  it('devuelve AppError ipc.invalid-output cuando el handler devuelve algo con forma distinta a la del schema', async () => {
    const { handleIpcRequest } = await import('./router.js');
    const result = await handleIpcRequest(undefined, { channel: 'app.ping', payload: {} });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('ipc.invalid-output');
  });
});
