import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ok } from '@ycore/result';
import { useSettingsQuery } from './use-settings-query.js';
import type { YcoreBridge } from '../../../../preload/index.js';

const SAMPLE_SETTINGS = {
  schemaVersion: 1,
  language: null,
  updateChannel: 'stable' as const,
  maxDownloadBytesPerSecond: null,
  discordRichPresenceEnabled: true,
  closeToTray: false,
};

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  Object.assign(window, { ycore: { settings: {} } as unknown as YcoreBridge });
});

describe('useSettingsQuery', () => {
  it('caso feliz: devuelve los settings tal cual los reporta el bridge', async () => {
    window.ycore.settings.get = vi.fn().mockResolvedValue(ok({ settings: SAMPLE_SETTINGS }));

    const { result } = renderHook(() => useSettingsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(SAMPLE_SETTINGS);
  });
});
