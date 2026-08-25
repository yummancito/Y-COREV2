import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { err, ok } from '@ycore/result';
import { useLibraryQuery } from './use-library-query.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  // No reemplazar `window` entero: un spread superficial ({ ...window })
  // pierde el prototipo real de Window y sus accessors (document incluido),
  // dejando un objeto que ya no sirve como entorno de jsdom. Solo se agrega
  // la propiedad que el test necesita mockear.
  Object.assign(window, { ycore: { library: {} } as unknown as YcoreBridge });
});

describe('useLibraryQuery', () => {
  it('caso feliz: devuelve la lista de juegos cuando el bridge responde ok', async () => {
    const games = [{ appId: 730, name: 'Counter-Strike 2', installation: null }];
    window.ycore.library.list = vi.fn().mockResolvedValue(ok({ games }));

    const { result } = renderHook(() => useLibraryQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(games);
  });

  it('cuando el bridge devuelve un AppError, el hook queda en estado de error', async () => {
    window.ycore.library.list = vi.fn().mockResolvedValue(err({ code: 'unknown', retriable: false }));

    const { result } = renderHook(() => useLibraryQuery(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
