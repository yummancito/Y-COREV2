/**
 * `useSettingsQuery` — trae la configuración actual vía `window.ycore.settings.get`.
 *
 * Sirve como la única forma en que el renderer lee `AppSettings`. Sin
 * polling: a diferencia de `downloads.list`/`updates.getStatus`, los settings
 * no cambian solos — solo por una acción explícita del usuario, que
 * `useUpdateSettings` ya invalida en `onSuccess`.
 */

import { useQuery } from '@tanstack/react-query';
import { isErr } from '@ycore/result';

/** Clave de query de los settings. Se exporta para que `useUpdateSettings` la invalide. */
export const settingsQueryKey = ['settings'] as const;

async function fetchSettings() {
  const result = await window.ycore.settings.get({});
  if (isErr(result)) throw new Error(result.error.code);
  return result.value.settings;
}

/** Hook de TanStack Query sobre los settings actuales. */
export function useSettingsQuery() {
  return useQuery({ queryKey: settingsQueryKey, queryFn: fetchSettings });
}
