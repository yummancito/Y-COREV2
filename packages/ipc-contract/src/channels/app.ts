/**
 * Canales del namespace `app.*` — operaciones que no pertenecen a ninguna
 * feature vertical, solo al proceso en sí (arranque, salud del puente IPC).
 *
 * Sirve de canal de referencia mínimo: es el primero que existió en el
 * contrato, se usa para el test de arranque de `apps/desktop` (ADR-0002 —
 * "test de arranque que verifica contextIsolation, nodeIntegration, sandbox")
 * antes de que exista ninguna feature real.
 */

import { z } from 'zod';
import { defineChannel } from '../channel.js';

const ping = defineChannel(
  z.object({}).describe('Sin payload: solo confirma que el puente IPC responde.'),
  z
    .object({ pong: z.literal(true), receivedAt: z.iso.datetime() })
    .describe('Confirmación de que el main process está vivo y respondiendo.'),
);

/** Canales del namespace `app.*`. */
export const appChannels = {
  'app.ping': ping,
};
