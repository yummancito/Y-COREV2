import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ok } from '@ycore/result';
import { useDownloadsQuery } from './use-downloads-query.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  Object.assign(window, { ycore: { downloads: {} } as unknown as YcoreBridge });
});

describe('useDownloadsQuery — polling condicional', () => {
  it('sigue pidiendo mientras haya una descarga activa (downloading)', async () => {
    const listFn = vi
      .fn()
      .mockResolvedValue(ok({ downloads: [{ state: { id: 'd1', status: 'downloading', bytesDownloaded: 1, bytesTotal: null }, appId: 730 }] }));
    window.ycore.downloads.list = listFn;

    renderHook(() => useDownloadsQuery(), { wrapper });

    await waitFor(() => expect(listFn.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
  });

  it('no vuelve a pedir si todas las descargas ya están en un estado terminal', async () => {
    const listFn = vi.fn().mockResolvedValue(ok({ downloads: [{ state: { id: 'd1', status: 'done' }, appId: 730 }] }));
    window.ycore.downloads.list = listFn;

    const { result } = renderHook(() => useDownloadsQuery(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callsAfterFirstFetch = listFn.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(listFn.mock.calls.length).toBe(callsAfterFirstFetch);
  });
});
