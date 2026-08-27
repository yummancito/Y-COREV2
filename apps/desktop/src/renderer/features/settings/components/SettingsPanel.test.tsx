import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { err, ok } from '@ycore/result';
import { SettingsPanel } from './SettingsPanel.js';
import type { YcoreBridge } from '../../../../preload/index.js';

const SAMPLE_SETTINGS = {
  schemaVersion: 1,
  language: null,
  updateChannel: 'stable' as const,
  maxDownloadBytesPerSecond: null,
  discordRichPresenceEnabled: true,
  closeToTray: false,
};

function renderWithClient(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SettingsPanel />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.assign(window, { ycore: { settings: {} } as unknown as YcoreBridge });
});

describe('SettingsPanel', () => {
  it('muestra el estado de carga mientras la query está pendiente', () => {
    window.ycore.settings.get = vi.fn().mockReturnValue(new Promise(() => {}));

    renderWithClient();

    expect(screen.getByText('Cargando ajustes…')).toBeInTheDocument();
  });

  it('muestra el mensaje de error si el bridge devuelve un AppError', async () => {
    window.ycore.settings.get = vi.fn().mockResolvedValue(err({ code: 'unknown', retriable: false }));

    renderWithClient();

    await waitFor(() => expect(screen.getByText(/No se pudieron cargar los ajustes/)).toBeInTheDocument());
  });

  it('muestra los valores actuales una vez cargados', async () => {
    window.ycore.settings.get = vi.fn().mockResolvedValue(ok({ settings: SAMPLE_SETTINGS }));

    renderWithClient();

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Canal de actualizaciones' })).toHaveValue('stable'));
    expect(screen.getByRole('checkbox', { name: 'Mostrar presencia en Discord' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Minimizar a la bandeja al cerrar' })).not.toBeChecked();
  });

  it('cambiar el canal de actualizaciones llama a settings.update con el patch mínimo', async () => {
    window.ycore.settings.get = vi.fn().mockResolvedValue(ok({ settings: SAMPLE_SETTINGS }));
    window.ycore.settings.update = vi.fn().mockResolvedValue(ok({ settings: { ...SAMPLE_SETTINGS, updateChannel: 'beta' } }));

    renderWithClient();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Canal de actualizaciones' })).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Canal de actualizaciones' }), 'beta');

    await waitFor(() => expect(window.ycore.settings.update).toHaveBeenCalledWith({ settings: { updateChannel: 'beta' } }));
  });

});

describe('SettingsPanel — más controles', () => {
  it('cambiar el idioma manda el código o null si vuelve a "seguir el sistema"', async () => {
    window.ycore.settings.get = vi.fn().mockResolvedValue(ok({ settings: SAMPLE_SETTINGS }));
    window.ycore.settings.update = vi.fn().mockResolvedValue(ok({ settings: { ...SAMPLE_SETTINGS, language: 'es' } }));

    renderWithClient();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Idioma' })).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Idioma' }), 'es');

    await waitFor(() => expect(window.ycore.settings.update).toHaveBeenCalledWith({ settings: { language: 'es' } }));
  });

  it('desmarcar Discord y marcar la bandeja llaman a settings.update con cada patch', async () => {
    window.ycore.settings.get = vi.fn().mockResolvedValue(ok({ settings: SAMPLE_SETTINGS }));
    window.ycore.settings.update = vi.fn().mockResolvedValue(ok({ settings: SAMPLE_SETTINGS }));

    renderWithClient();
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mostrar presencia en Discord' })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('checkbox', { name: 'Mostrar presencia en Discord' }));
    await waitFor(() => expect(window.ycore.settings.update).toHaveBeenCalledWith({ settings: { discordRichPresenceEnabled: false } }));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Minimizar a la bandeja al cerrar' }));
    await waitFor(() => expect(window.ycore.settings.update).toHaveBeenCalledWith({ settings: { closeToTray: true } }));
  });
});
