/**
 * Punto de entrada del renderer. Monta React en `#root`. Sin router ni
 * providers todavía (TanStack Router/Query llegan en Fase 1/2 según el
 * roadmap) — por ahora solo prueba que el puente `window.ycore` funciona.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No se encontró #root en index.html');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
