import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { err, ok } from '@ycore/result';
import { useUpdateSettings } from './use-update-settings.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  Object.assign(window, { ycore: { settings: {} } as unknown as YcoreBridge });
});

describe('useUpdateSettings', () => {
  it('caso feliz: mutate con un patch llama al bridge con { settings: patch }', async () => {
    window.ycore.settings.update = vi.fn().mockResolvedValue(ok({ settings: {} }));

    const { result } = renderHook(() => useUpdateSettings(), { wrapper });
    act(() => result.current.mutate({ language: 'es' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(window.ycore.settings.update).toHaveBeenCalledWith({ settings: { language: 'es' } });
  });

  it('cuando el bridge devuelve un AppError, la mutación queda en estado de error', async () => {
    window.ycore.settings.update = vi.fn().mockResolvedValue(err({ code: 'unknown', retriable: false }));

    const { result } = renderHook(() => useUpdateSettings(), { wrapper });
    act(() => result.current.mutate({ language: 'es' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
