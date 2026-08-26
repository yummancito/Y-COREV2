import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { err, ok } from '@ycore/result';
import { useEnqueueDownload } from './use-enqueue-download.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  Object.assign(window, { ycore: { downloads: {} } as unknown as YcoreBridge });
});

describe('useEnqueueDownload', () => {
  it('caso feliz: mutate encola la descarga y resuelve con su id', async () => {
    window.ycore.downloads.enqueue = vi.fn().mockResolvedValue(ok({ id: 'd1' }));
    const input = { appId: 730, sourceUrl: 'https://example.invalid/cs2.zip', installPath: 'C:\\cs2', expectedSha256: 'a'.repeat(64) };

    const { result } = renderHook(() => useEnqueueDownload(), { wrapper });
    act(() => result.current.mutate(input));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 'd1' });
    expect(window.ycore.downloads.enqueue).toHaveBeenCalledWith(input);
  });

  it('cuando el bridge devuelve download.duplicate, la mutación queda en estado de error', async () => {
    window.ycore.downloads.enqueue = vi.fn().mockResolvedValue(err({ code: 'download.duplicate', retriable: false }));
    const input = { appId: 730, sourceUrl: 'https://example.invalid/cs2.zip', installPath: 'C:\\cs2', expectedSha256: 'a'.repeat(64) };

    const { result } = renderHook(() => useEnqueueDownload(), { wrapper });
    act(() => result.current.mutate(input));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
