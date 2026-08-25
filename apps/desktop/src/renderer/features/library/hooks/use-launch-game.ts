/**
 * `useLaunchGame` — lanza un juego vía `window.ycore.library.launch`.
 *
 * Sirve como la única forma en que el renderer dispara un lanzamiento. Igual
 * que `useLibraryQuery`, traduce el `Result` del bridge IPC a las
 * convenciones de TanStack Query (éxito → dato, `AppError` → excepción
 * lanzada) para que el componente que lo use solo necesite `mutate`/
 * `isPending`/`isError`, sin tocar `Result` directamente.
 */

import { useMutation } from '@tanstack/react-query';
import { isErr } from '@ycore/result';

async function launchGame(appId: number) {
  const result = await window.ycore.library.launch({ appId });
  if (isErr(result)) throw new Error(result.error.code);
  return result.value;
}

/** Hook de mutación de TanStack Query para lanzar un juego por su AppID. */
export function useLaunchGame() {
  return useMutation({ mutationFn: launchGame });
}
