/**
 * Setup de Vitest para el proyecto "renderer" (ver vitest.config.ts —
 * `test.projects`). Este archivo solo corre con los tests bajo
 * `src/renderer/**`, así que puede asumir que `document` existe.
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// @testing-library/react no limpia el DOM entre tests por sí solo en Vitest
// (a diferencia de Jest, donde un hook automático global lo hace) — sin esto,
// cada test deja su render montado y el siguiente `render()` encuentra
// duplicados (p. ej. dos botones "Jugar" en vez de uno).
afterEach(() => {
  cleanup();
});
