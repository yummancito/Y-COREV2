import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DownloadRow } from './DownloadRow.js';

describe('DownloadRow', () => {
  it('muestra el estado legible y el appId', () => {
    render(
      <ul>
        <DownloadRow download={{ appId: 730, state: { id: 'd1', status: 'queued' } }} onPause={vi.fn()} onCancel={vi.fn()} />
      </ul>,
    );

    expect(screen.getByText('AppID 730')).toBeInTheDocument();
    expect(screen.getByText('En cola')).toBeInTheDocument();
  });

  it('muestra la barra de progreso con el porcentaje cuando está downloading', () => {
    render(
      <ul>
        <DownloadRow
          download={{ appId: 730, state: { id: 'd1', status: 'downloading', bytesDownloaded: 50, bytesTotal: 100 } }}
          onPause={vi.fn()}
          onCancel={vi.fn()}
        />
      </ul>,
    );

    expect(screen.getByRole('progressbar')).toHaveValue(50);
  });

  it('muestra el mensaje de error cuando el estado es failed', () => {
    render(
      <ul>
        <DownloadRow
          download={{ appId: 730, state: { id: 'd1', status: 'failed', error: { code: 'download.integrity-mismatch' } } }}
          onPause={vi.fn()}
          onCancel={vi.fn()}
        />
      </ul>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('download.integrity-mismatch');
  });
});
