/**
 * `useInstallUpdate` — dispara la instalación vía `window.ycore.updates.installNow`.
 *
 * Sirve como la única forma en que el usuario decide instalar una
 * actualización ya descargada y verificada: la app nunca instala sola en
 * segundo plano (ADR-0003). Tras invocarlo, Y-CORE se cierra para dejar
 * correr el instalador silencioso — no hay `onSuccess` que invalidar porque
 * no hay nada más que esperar en este proceso.
 */

import { useMutation } from '@tanstack/react-query';
import { isErr } from '@ycore/result';

async function installUpdate() {
  const result = await window.ycore.updates.installNow({});
  if (isErr(result)) throw new Error(result.error.code);
  return result.value;
}

/** Hook de mutación de TanStack Query para instalar la actualización lista. */
export function useInstallUpdate() {
  return useMutation({ mutationFn: installUpdate });
}
