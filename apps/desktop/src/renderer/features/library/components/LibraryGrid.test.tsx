import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { err, ok } from '@ycore/result';
import { LibraryGrid } from './LibraryGrid.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function renderWithClient(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LibraryGrid />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // No reemplazar `window` entero: un spread superficial ({ ...window })
  // pierde el prototipo real de Window y sus accessors (document incluido).
  Object.assign(window, { ycore: { library: {} } as unknown as YcoreBridge });
});

describe('LibraryGrid', () => {
  it('muestra el estado de carga mientras la query está pendiente', () => {
    window.ycore.library.list = vi.fn().mockReturnValue(new Promise(() => {}));

    renderWithClient();

    expect(screen.getByText('Cargando biblioteca…')).toBeInTheDocument();
  });

  it('muestra un mensaje cuando la biblioteca está vacía', async () => {
    window.ycore.library.list = vi.fn().mockResolvedValue(ok({ games: [] }));

    renderWithClient();

    await waitFor(() => {
      expect(screen.getByText('No hay juegos en la biblioteca todavía.')).toBeInTheDocument();
    });
  });

  it('muestra un GameCard por cada juego devuelto', async () => {
    window.ycore.library.list = vi.fn().mockResolvedValue(
      ok({
        games: [
          { appId: 730, name: 'Counter-Strike 2', installation: null },
          { appId: 70, name: 'Half-Life', installation: null },
        ],
      }),
    );

    renderWithClient();

    await waitFor(() => {
      expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
      expect(screen.getByText('Half-Life')).toBeInTheDocument();
    });
  });

  it('muestra el mensaje de error si el bridge devuelve un AppError', async () => {
    window.ycore.library.list = vi.fn().mockResolvedValue(err({ code: 'unknown', retriable: false }));

    renderWithClient();

    await waitFor(() => {
      expect(screen.getByText(/No se pudo cargar la biblioteca/)).toBeInTheDocument();
    });
  });
});
