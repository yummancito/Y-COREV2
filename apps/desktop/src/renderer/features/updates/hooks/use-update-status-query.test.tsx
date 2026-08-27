import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ok } from '@ycore/result';
import { useUpdateStatusQuery } from './use-update-status-query.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  Object.assign(window, { ycore: { updates: {} } as unknown as YcoreBridge });
});

describe('useUpdateStatusQuery', () => {
  it('caso feliz: devuelve el estado tal cual lo reporta el bridge', async () => {
    window.ycore.updates.getStatus = vi.fn().mockResolvedValue(ok({ status: { phase: 'up-to-date' } }));

    const { result } = renderHook(() => useUpdateStatusQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ phase: 'up-to-date' });
  });
});
