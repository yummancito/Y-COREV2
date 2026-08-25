import { describe, expect, it, vi } from 'vitest';

const BrowserWindowMock = vi.fn().mockImplementation(function BrowserWindowStub() {
  return {
    on: vi.fn(),
    webContents: { setWindowOpenHandler: vi.fn() },
    loadURL: vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('electron', () => ({
  BrowserWindow: BrowserWindowMock,
  shell: { openExternal: vi.fn() },
}));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }));

describe('createMainWindow — criterio de HECHO de Fase 1 (ADR-0002)', () => {
  it('crea la ventana con contextIsolation, sandbox on y nodeIntegration off', async () => {
    const { createMainWindow } = await import('./window.js');
    createMainWindow();

    const [options] = BrowserWindowMock.mock.calls[0] as [{ webPreferences: Record<string, unknown> }];
    expect(options.webPreferences['contextIsolation']).toBe(true);
    expect(options.webPreferences['nodeIntegration']).toBe(false);
    expect(options.webPreferences['sandbox']).toBe(true);
  });
});
