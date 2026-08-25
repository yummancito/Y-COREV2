import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { err, ok } from '@ycore/result';
import { useLaunchGame } from './use-launch-game.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  // No reemplazar `window` entero: un spread superficial ({ ...window })
  // pierde el prototipo real de Window y sus accessors (document incluido).
  Object.assign(window, { ycore: { library: {} } as unknown as YcoreBridge });
});

describe('useLaunchGame', () => {
  it('caso feliz: mutate con un appId llama al bridge y resuelve con el pid', async () => {
    window.ycore.library.launch = vi.fn().mockResolvedValue(ok({ pid: 1234 }));

    const { result } = renderHook(() => useLaunchGame(), { wrapper });
    act(() => result.current.mutate(730));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ pid: 1234 });
    expect(window.ycore.library.launch).toHaveBeenCalledWith({ appId: 730 });
  });

  it('cuando el bridge devuelve un AppError, la mutación queda en estado de error', async () => {
    window.ycore.library.launch = vi.fn().mockResolvedValue(err({ code: 'not-found', retriable: false }));

    const { result } = renderHook(() => useLaunchGame(), { wrapper });
    act(() => result.current.mutate(999999));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
