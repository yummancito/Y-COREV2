import { describe, expect, it, vi } from 'vitest';
import { isErr, isOk, ok } from '@ycore/result';
import { handleIpcRequest } from './router.js';
import type { Registry } from './registry.js';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('@ycore/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() }),
}));

// Registry fake mínimo: estos tests prueban el flujo del router (canal
// desconocido, input inválido, caso feliz), no el comportamiento de cada
// handler real — eso lo cubren registry.test.ts y los tests de cada feature.
const fakeRegistry = {
  'app.ping': () => Promise.resolve(ok({ pong: true, receivedAt: new Date().toISOString() })),
} as unknown as Registry;

describe('handleIpcRequest', () => {
  it('canal desconocido devuelve AppError ipc.unknown-channel', async () => {
    const result = await handleIpcRequest(fakeRegistry, undefined, {
      channel: 'no.existe',
      payload: {},
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('ipc.unknown-channel');
  });

  it('payload con tipo incorrecto devuelve AppError ipc.invalid-input', async () => {
    const result = await handleIpcRequest(fakeRegistry, undefined, {
      channel: 'app.ping',
      payload: 'no es un objeto',
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('ipc.invalid-input');
  });

  it('caso feliz: app.ping devuelve ok con pong true', async () => {
    const result = await handleIpcRequest(fakeRegistry, undefined, {
      channel: 'app.ping',
      payload: {},
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const value = result.value as { pong: boolean };
      expect(value.pong).toBe(true);
    }
  });
});
