import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadRow } from './DownloadRow.js';

describe('DownloadRow — botones', () => {
  it('el botón Pausar solo está habilitado en downloading', () => {
    render(
      <ul>
        <DownloadRow download={{ appId: 730, state: { id: 'd1', status: 'queued' } }} onPause={vi.fn()} onCancel={vi.fn()} />
      </ul>,
    );

    expect(screen.getByRole('button', { name: 'Pausar' })).toBeDisabled();
  });

  it('el botón Pausar dispara onPause con el id cuando está downloading', async () => {
    const onPause = vi.fn();
    render(
      <ul>
        <DownloadRow
          download={{ appId: 730, state: { id: 'd1', status: 'downloading', bytesDownloaded: 10, bytesTotal: null } }}
          onPause={onPause}
          onCancel={vi.fn()}
        />
      </ul>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Pausar' }));

    expect(onPause).toHaveBeenCalledWith('d1');
  });

  it('el botón Cancelar dispara onCancel con el id', async () => {
    const onCancel = vi.fn();
    render(
      <ul>
        <DownloadRow download={{ appId: 730, state: { id: 'd1', status: 'queued' } }} onPause={vi.fn()} onCancel={onCancel} />
      </ul>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledWith('d1');
  });

  it('el botón Cancelar está deshabilitado cuando la descarga ya terminó (done)', () => {
    render(
      <ul>
        <DownloadRow download={{ appId: 730, state: { id: 'd1', status: 'done' } }} onPause={vi.fn()} onCancel={vi.fn()} />
      </ul>,
    );

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
});
