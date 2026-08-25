/**
 * Punto de entrada del renderer. Monta React en `#root` con
 * `QueryClientProvider` — todo dato que venga del main process pasa por
 * TanStack Query (regla de la sección A.3 del roadmap), nunca por zustand.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App.js';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No se encontró #root en index.html');

const queryClient = new QueryClient();

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
