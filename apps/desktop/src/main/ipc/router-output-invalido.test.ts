import { describe, expect, it, vi } from 'vitest';
import { isErr, ok } from '@ycore/result';
import { handleIpcRequest } from './router.js';
import type { Registry } from './registry.js';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('@ycore/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() }),
}));

const registryConOutputInvalido = {
  'app.ping': () => Promise.resolve(ok({ pong: false, receivedAt: 'no-es-una-fecha-iso' })),
} as unknown as Registry;

describe('handleIpcRequest — output que no valida contra el contrato', () => {
  it('devuelve AppError ipc.invalid-output cuando el handler devuelve algo con forma distinta a la del schema', async () => {
    const result = await handleIpcRequest(registryConOutputInvalido, undefined, {
      channel: 'app.ping',
      payload: {},
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('ipc.invalid-output');
  });
});
