/**
 * `useUpdateSettings` — actualiza la configuración vía `window.ycore.settings.update`.
 *
 * Sirve como la única forma en que el renderer cambia un ajuste. Invalida la
 * query de settings al completar, igual que el resto de mutaciones del repo
 * (`usePauseDownload`, `useEnqueueDownload`).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isErr } from '@ycore/result';
import { settingsQueryKey } from './use-settings-query.js';
import type { YcoreBridge } from '../../../../preload/index.js';

type SettingsPatch = Parameters<YcoreBridge['settings']['update']>[0]['settings'];

async function updateSettings(patch: SettingsPatch) {
  const result = await window.ycore.settings.update({ settings: patch });
  if (isErr(result)) throw new Error(result.error.code);
  return result.value.settings;
}

/** Hook de mutación de TanStack Query para actualizar un parche de settings. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
  });
}
