import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { err, ok } from '@ycore/result';
import { useCancelDownload } from './use-cancel-download.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  Object.assign(window, { ycore: { downloads: {} } as unknown as YcoreBridge });
});

describe('useCancelDownload', () => {
  it('caso feliz: mutate con un id llama al bridge', async () => {
    window.ycore.downloads.cancel = vi.fn().mockResolvedValue(ok({}));

    const { result } = renderHook(() => useCancelDownload(), { wrapper });
    act(() => result.current.mutate('d1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(window.ycore.downloads.cancel).toHaveBeenCalledWith({ id: 'd1' });
  });

  it('cuando el bridge devuelve un AppError, la mutación queda en estado de error', async () => {
    window.ycore.downloads.cancel = vi.fn().mockResolvedValue(err({ code: 'not-found', retriable: false }));

    const { result } = renderHook(() => useCancelDownload(), { wrapper });
    act(() => result.current.mutate('inexistente'));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
