/**
 * Canales del namespace `settings.*` — configuración editable por el usuario (Fase 6).
 *
 * Sirve para que el renderer lea y actualice `AppSettings`
 * (`@ycore/core-domain`) sin conocer cómo se persiste. `appSettingsSchema`
 * espeja esa forma con Zod, igual patrón que `downloadStateSchema` en
 * `downloads.ts`: el contrato no importa `core-domain` para no acoplar la
 * frontera IPC al tipo interno del dominio.
 */

import { z } from 'zod';
import { defineChannel } from '../channel.js';

const appSettingsSchema = z
  .object({
    schemaVersion: z.number().int().positive().describe('Versión del esquema de settings, para migraciones futuras.'),
    language: z.string().nullable().describe('Idioma de la interfaz, o null para seguir el idioma del sistema operativo.'),
    updateChannel: z.enum(['stable', 'beta']).describe('Canal de actualizaciones suscrito.'),
    maxDownloadBytesPerSecond: z.number().int().positive().nullable().describe('Límite de ancho de banda para descargas, en bytes/segundo, o null sin límite.'),
    discordRichPresenceEnabled: z.boolean().describe('Si se muestra presencia enriquecida en Discord.'),
    closeToTray: z.boolean().describe('Si cerrar la ventana minimiza a la bandeja en vez de salir de la app.'),
  })
  .describe('La configuración completa editable por el usuario.');

const get = defineChannel(
  z.object({}).describe('Sin filtros: devuelve los settings actuales, ya migrados a la versión de esquema vigente.'),
  z.object({ settings: appSettingsSchema }).describe('Los settings actuales.'),
);

const update = defineChannel(
  z
    .object({ settings: appSettingsSchema.partial().omit({ schemaVersion: true }) })
    .describe('Los campos a cambiar — cualquier campo omitido conserva su valor actual.'),
  z.object({ settings: appSettingsSchema }).describe('Los settings ya actualizados y persistidos.'),
);

/** Canales del namespace `settings.*`. */
export const settingsChannels = {
  'settings.get': get,
  'settings.update': update,
};
