/**
 * Canales del namespace `downloads.*` — el motor de descargas (Fase 4, ADR-0004).
 *
 * Sirve para encolar una descarga, leer el estado de la cola completa (el
 * renderer hace polling de `downloads.list` con TanStack Query en vez de un
 * evento push — no existe todavía un patrón main→renderer en este repo, y
 * abrirlo es una decisión de arquitectura aparte), y pausar/cancelar una
 * descarga en curso. `downloadStateSchema` espeja la unión discriminada
 * `DownloadState` de `@ycore/core-domain` sin importarla — el contrato no
 * depende de `core-domain` para no acoplar la frontera IPC a los tipos
 * internos del dominio.
 */

import { z } from 'zod';
import { defineChannel } from '../channel.js';

const appErrorSchema = z
  .object({
    code: z.string().describe('Código estable del error (clave i18n).'),
    retriable: z.boolean().describe('Si reintentar la misma operación puede funcionar.'),
  })
  .describe('Error serializable que cruza la frontera IPC.');

const downloadStateSchema = z
  .discriminatedUnion('status', [
    z.object({ id: z.string(), status: z.literal('queued') }),
    z.object({
      id: z.string(),
      status: z.literal('downloading'),
      bytesDownloaded: z.number().int().nonnegative(),
      bytesTotal: z.number().int().nonnegative().nullable(),
    }),
    z.object({
      id: z.string(),
      status: z.literal('paused'),
      bytesDownloaded: z.number().int().nonnegative(),
      bytesTotal: z.number().int().nonnegative().nullable(),
    }),
    z.object({ id: z.string(), status: z.literal('verifying') }),
    z.object({ id: z.string(), status: z.literal('extracting') }),
    z.object({ id: z.string(), status: z.literal('installing') }),
    z.object({ id: z.string(), status: z.literal('done') }),
    z.object({ id: z.string(), status: z.literal('failed'), error: appErrorSchema }),
  ])
  .describe('El estado de una descarga — unión discriminada, un estado inválido no existe.');

const downloadSchema = z
  .object({
    state: downloadStateSchema,
    appId: z.number().int().positive().describe('AppID del juego al que pertenece la descarga.'),
  })
  .describe('Una descarga conocida, con su estado actual.');

const enqueue = defineChannel(
  z
    .object({
      appId: z.number().int().positive().describe('AppID del juego a descargar.'),
      sourceUrl: z.url().describe('De dónde descargar el archivo.'),
      installPath: z.string().describe('Dónde extraer/instalar tras verificar.'),
      expectedSha256: z.string().length(64).describe('Hash SHA-256 esperado del archivo, en hexadecimal.'),
    })
    .describe('Encola una descarga nueva.'),
  z
    .object({ id: z.string().describe('Id de la descarga encolada.') })
    .describe('La descarga quedó encolada (estado queued).'),
);

const list = defineChannel(
  z.object({}).describe('Sin filtros por ahora: devuelve toda la cola de descargas.'),
  z.object({ downloads: z.array(downloadSchema).describe('Todas las descargas conocidas.') })
    .describe('La cola completa. El renderer hace polling de este canal para ver el progreso.'),
);

const pause = defineChannel(
  z.object({ id: z.string().describe('Id de la descarga a pausar.') }).describe('Pausa una descarga en curso.'),
  z.object({}).describe('La descarga quedó pausada.'),
);

const cancel = defineChannel(
  z.object({ id: z.string().describe('Id de la descarga a cancelar.') }).describe('Cancela y borra una descarga.'),
  z.object({}).describe('La descarga y su archivo parcial quedaron borrados.'),
);

/** Canales del namespace `downloads.*`. */
export const downloadsChannels = {
  'downloads.enqueue': enqueue,
  'downloads.list': list,
  'downloads.pause': pause,
  'downloads.cancel': cancel,
};
