import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { err, ok } from '@ycore/result';
import { DownloadsList } from './DownloadsList.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function renderWithClient(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DownloadsList />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.assign(window, { ycore: { downloads: {} } as unknown as YcoreBridge });
});

describe('DownloadsList', () => {
  it('muestra el estado de carga mientras la query está pendiente', () => {
    window.ycore.downloads.list = vi.fn().mockReturnValue(new Promise(() => {}));

    renderWithClient();

    expect(screen.getByText('Cargando descargas…')).toBeInTheDocument();
  });

  it('muestra un mensaje cuando la cola está vacía', async () => {
    window.ycore.downloads.list = vi.fn().mockResolvedValue(ok({ downloads: [] }));

    renderWithClient();

    await waitFor(() => {
      expect(screen.getByText('No hay descargas en la cola.')).toBeInTheDocument();
    });
  });

  it('muestra una fila por cada descarga devuelta', async () => {
    window.ycore.downloads.list = vi.fn().mockResolvedValue(
      ok({
        downloads: [
          { state: { id: 'd1', status: 'queued' }, appId: 730 },
          { state: { id: 'd2', status: 'done' }, appId: 70 },
        ],
      }),
    );

    renderWithClient();

    await waitFor(() => {
      expect(screen.getByText('AppID 730')).toBeInTheDocument();
      expect(screen.getByText('AppID 70')).toBeInTheDocument();
    });
  });

  it('muestra el mensaje de error si el bridge devuelve un AppError', async () => {
    window.ycore.downloads.list = vi.fn().mockResolvedValue(err({ code: 'unknown', retriable: false }));

    renderWithClient();

    await waitFor(() => {
      expect(screen.getByText(/No se pudo cargar la cola de descargas/)).toBeInTheDocument();
    });
  });

  it('cancelar una fila llama a window.ycore.downloads.cancel con su id', async () => {
    window.ycore.downloads.list = vi.fn().mockResolvedValue(ok({ downloads: [{ state: { id: 'd1', status: 'queued' }, appId: 730 }] }));
    window.ycore.downloads.cancel = vi.fn().mockResolvedValue(ok({}));

    renderWithClient();
    await waitFor(() => expect(screen.getByText('AppID 730')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(window.ycore.downloads.cancel).toHaveBeenCalledWith({ id: 'd1' }));
  });
});
