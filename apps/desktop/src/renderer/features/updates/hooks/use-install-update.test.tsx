import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ok, err } from '@ycore/result';
import { useInstallUpdate } from './use-install-update.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  Object.assign(window, { ycore: { updates: {} } as unknown as YcoreBridge });
});

describe('useInstallUpdate', () => {
  it('caso feliz: mutate llama al bridge', async () => {
    window.ycore.updates.installNow = vi.fn().mockResolvedValue(ok({}));

    const { result } = renderHook(() => useInstallUpdate(), { wrapper });
    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(window.ycore.updates.installNow).toHaveBeenCalledWith({});
  });

  it('cuando el bridge devuelve un AppError, la mutación queda en estado de error', async () => {
    window.ycore.updates.installNow = vi.fn().mockResolvedValue(err({ code: 'io.failed', retriable: false }));

    const { result } = renderHook(() => useInstallUpdate(), { wrapper });
    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
