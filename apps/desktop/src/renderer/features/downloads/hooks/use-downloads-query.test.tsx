import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { err, ok } from '@ycore/result';
import { useDownloadsQuery } from './use-downloads-query.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  // No reemplazar `window` entero: un spread superficial ({ ...window })
  // pierde el prototipo real de Window y sus accessors (document incluido).
  Object.assign(window, { ycore: { downloads: {} } as unknown as YcoreBridge });
});

describe('useDownloadsQuery', () => {
  it('caso feliz: devuelve la cola de descargas cuando el bridge responde ok', async () => {
    const downloads = [{ state: { id: 'd1', status: 'queued' }, appId: 730 }];
    window.ycore.downloads.list = vi.fn().mockResolvedValue(ok({ downloads }));

    const { result } = renderHook(() => useDownloadsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(downloads);
  });

  it('cuando el bridge devuelve un AppError, el hook queda en estado de error', async () => {
    window.ycore.downloads.list = vi.fn().mockResolvedValue(err({ code: 'unknown', retriable: false }));

    const { result } = renderHook(() => useDownloadsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
