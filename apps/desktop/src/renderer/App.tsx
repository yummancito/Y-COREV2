/**
 * `App` — pantalla mínima de arranque de Fase 1.
 *
 * Sirve para verificar de extremo a extremo que el puente IPC funciona:
 * llama a `window.ycore.app.ping()` al montar y muestra la respuesta. No es
 * una feature real — se reemplaza en Fase 2 por el router de TanStack Router
 * y la primera feature vertical (biblioteca).
 */

import { useEffect, useState } from 'react';
import { isErr } from '@ycore/result';

type PingState =
  | { status: 'loading' }
  | { status: 'ok'; receivedAt: string }
  | { status: 'error'; code: string };

export function App(): React.JSX.Element {
  const [ping, setPing] = useState<PingState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    window.ycore.app
      .ping({})
      .then((result) => {
        if (cancelled) return;
        setPing(isErr(result) ? { status: 'error', code: result.error.code } : { status: 'ok', receivedAt: result.value.receivedAt });
      })
      .catch(() => {
        if (!cancelled) setPing({ status: 'error', code: 'unknown' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>Y-CORE</h1>
      <p>Puente IPC: {ping.status === 'loading' ? 'comprobando…' : ping.status === 'ok' ? `activo (${ping.receivedAt})` : `error (${ping.code})`}</p>
    </main>
  );
}
