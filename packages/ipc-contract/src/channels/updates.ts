/**
 * Canales del namespace `updates.*` — actualizaciones de la propia app (Fase 5, ADR-0003/ADR-0005).
 *
 * Sirve para que el renderer muestre "hay una actualización" sin conocer el
 * cliente de updates ni el Worker: `updates.getStatus` es de solo lectura
 * (polling con TanStack Query, mismo patrón que `downloads.list`), y
 * `updates.installNow` es la única acción — el usuario decide cuándo
 * interrumpir, la app nunca instala sola en segundo plano (ADR-0003:
 * "nunca interrumpe una descarga de juego en curso", y por extensión, nunca
 * decide sola cuándo reiniciar).
 */

import { z } from 'zod';
import { defineChannel } from '../channel.js';

const updateStatusSchema = z
  .discriminatedUnion('phase', [
    z.object({ phase: z.literal('up-to-date') }),
    z.object({
      phase: z.literal('available'),
      version: z.string().describe('Versión disponible.'),
      mandatory: z.boolean().describe('Si la actualización es obligatoria.'),
      notes: z.object({ es: z.string(), en: z.string() }).describe('Notas de la release, por idioma.'),
    }),
    z.object({
      phase: z.literal('downloading'),
      version: z.string().describe('Versión que se está descargando.'),
      bytesDownloaded: z.number().int().nonnegative(),
      bytesTotal: z.number().int().nonnegative().nullable(),
    }),
    z.object({
      phase: z.literal('ready-to-install'),
      version: z.string().describe('Versión ya descargada y verificada, lista para instalar.'),
      mandatory: z.boolean(),
    }),
    z.object({
      phase: z.literal('failed'),
      reason: z.enum(['download-failed', 'verification-failed']).describe('Por qué no se pudo completar.'),
    }),
    z.object({
      phase: z.literal('blocked'),
      reason: z.string().describe('Código corto del motivo del bloqueo (kill-switch), tal como lo manda el Worker.'),
      message: z.object({ es: z.string(), en: z.string() }).describe('Mensaje explicando el bloqueo, por idioma.'),
      forceUpdateTo: z.string().describe('Versión a la que hay que actualizar para dejar de estar bloqueado.'),
    }),
  ])
  .describe(
    'Estado actual del ciclo de actualización, tal como lo ve el renderer. ' +
      'No existe un estado "en mantenimiento": el Worker lo hace indistinguible de up-to-date (ADR-0003).',
  );

const getStatus = defineChannel(
  z.object({}).describe('Sin filtros: devuelve el estado actual del ciclo de actualización.'),
  z.object({ status: updateStatusSchema }).describe('El estado actual, para que el renderer haga polling.'),
);

const installNow = defineChannel(
  z.object({}).describe('Instala la actualización ya descargada y verificada (fase ready-to-install) y cierra la app.'),
  z.object({}).describe('La instalación se lanzó; la app va a cerrarse.'),
);

/** Canales del namespace `updates.*`. */
export const updatesChannels = {
  'updates.getStatus': getStatus,
  'updates.installNow': installNow,
};
