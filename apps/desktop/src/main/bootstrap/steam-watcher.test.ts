import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { YCoreDatabase } from '../db/index.js';

const appOnMock = vi.fn();
vi.mock('electron', () => ({ app: { on: appOnMock } }));

const stopMock = vi.fn().mockResolvedValue(undefined);
const startSteamLibraryWatcherMock = vi.fn().mockResolvedValue(stopMock);
const importLibraryMock = vi.fn().mockResolvedValue({ ok: true, value: { gamesFound: 3 } });
vi.mock('../features/steam/index.js', () => ({
  SteamService: vi.fn().mockImplementation(function SteamServiceStub() {
    return { importLibrary: importLibraryMock };
  }),
  startSteamLibraryWatcher: startSteamLibraryWatcherMock,
}));
vi.mock('../features/library/index.js', () => ({
  LibraryRepository: vi.fn().mockImplementation(function LibraryRepositoryStub() {
    return {};
  }),
}));

describe('startSteamWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importLibraryMock.mockResolvedValue({ ok: true, value: { gamesFound: 3 } });
    startSteamLibraryWatcherMock.mockResolvedValue(stopMock);
  });

  it('importa la biblioteca una vez antes de arrancar el watcher', async () => {
    const { startSteamWatcher } = await import('./steam-watcher.js');
    const fakeDb = {} as YCoreDatabase;

    await startSteamWatcher(fakeDb);

    expect(importLibraryMock).toHaveBeenCalledOnce();
  });

  it('arranca el watcher de la feature y lo detiene en will-quit', async () => {
    const { startSteamWatcher } = await import('./steam-watcher.js');
    const fakeDb = {} as YCoreDatabase;

    await startSteamWatcher(fakeDb);

    expect(startSteamLibraryWatcherMock).toHaveBeenCalledOnce();
    expect(appOnMock).toHaveBeenCalledWith('will-quit', expect.any(Function));

    const [, willQuitHandler] = appOnMock.mock.calls[0] as [string, () => void];
    willQuitHandler();
    expect(stopMock).toHaveBeenCalledOnce();
  });
});
