import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ok } from '@ycore/result';
import { UpdateBanner } from './UpdateBanner.js';
import type { YcoreBridge } from '../../../../preload/index.js';

function renderWithClient(): { container: HTMLElement } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UpdateBanner />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.assign(window, { ycore: { updates: {} } as unknown as YcoreBridge });
});

describe('UpdateBanner', () => {
  it('no renderiza nada si está up-to-date', async () => {
    window.ycore.updates.getStatus = vi.fn().mockResolvedValue(ok({ status: { phase: 'up-to-date' } }));

    const { container } = renderWithClient();

    await waitFor(() => expect(window.ycore.updates.getStatus).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra la versión disponible mientras se descarga', async () => {
    window.ycore.updates.getStatus = vi.fn().mockResolvedValue(ok({ status: { phase: 'available', version: '5.1.0', mandatory: false, notes: { es: '', en: '' } } }));

    renderWithClient();

    await waitFor(() => expect(screen.getByText(/Descargando la actualización a la versión 5.1.0/)).toBeInTheDocument());
  });

  it('muestra el porcentaje de progreso en downloading', async () => {
    window.ycore.updates.getStatus = vi
      .fn()
      .mockResolvedValue(ok({ status: { phase: 'downloading', version: '5.1.0', bytesDownloaded: 50, bytesTotal: 100 } }));

    renderWithClient();

    await waitFor(() => expect(screen.getByText(/Descargando actualización 5.1.0 \(50%\)/)).toBeInTheDocument());
  });

  it('en ready-to-install muestra el botón de instalar y lo invoca', async () => {
    window.ycore.updates.getStatus = vi.fn().mockResolvedValue(ok({ status: { phase: 'ready-to-install', version: '5.1.0', mandatory: false } }));
    window.ycore.updates.installNow = vi.fn().mockResolvedValue(ok({}));

    renderWithClient();

    await waitFor(() => expect(screen.getByText(/Hay una actualización lista: versión 5.1.0/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Instalar y reiniciar' }));

    await waitFor(() => expect(window.ycore.updates.installNow).toHaveBeenCalledWith({}));
  });

  it('en failed muestra un mensaje de reintento', async () => {
    window.ycore.updates.getStatus = vi.fn().mockResolvedValue(ok({ status: { phase: 'failed', reason: 'download-failed' } }));

    renderWithClient();

    await waitFor(() => expect(screen.getByText(/No se pudo completar la actualización/)).toBeInTheDocument());
  });
});

describe('UpdateBanner — kill-switch', () => {
  it('en blocked muestra el modal de kill-switch con la versión a la que forzar', async () => {
    window.ycore.updates.getStatus = vi.fn().mockResolvedValue(
      ok({
        status: {
          phase: 'blocked',
          reason: 'critical-bug',
          message: { es: 'Esta versión ya no es compatible.', en: 'critical bug' },
          forceUpdateTo: '5.1.0',
        },
      }),
    );

    renderWithClient();

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
    expect(screen.getByText('Esta versión ya no es compatible.')).toBeInTheDocument();
    expect(screen.getByText(/Actualiza a la versión 5.1.0/)).toBeInTheDocument();
  });
});
