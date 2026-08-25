/**
 * Canales del namespace `library.*` — la feature Biblioteca (Fase 2 del
 * roadmap, "el molde canónico de todas las features").
 *
 * Sirve para listar los juegos conocidos y lanzar uno instalado. La forma de
 * `Game`/`Installation` que viaja en el output espeja `@ycore/core-domain`
 * (sin importarlo — el contrato no depende de core-domain para no acoplar la
 * frontera IPC a los tipos internos del dominio; si cambia la forma interna,
 * el contrato no tiene por qué romperse).
 */

import { z } from 'zod';
import { defineChannel } from '../channel.js';

const installationSchema = z
  .object({
    path: z.string().describe('Ruta absoluta de la carpeta de instalación.'),
    executablePath: z.string().nullable().describe('Ruta del ejecutable, o null si no está resuelta.'),
    sizeOnDiskBytes: z.number().int().nonnegative().describe('Tamaño en disco, en bytes.'),
    lastPlayedAt: z.iso.datetime().nullable().describe('Última vez jugado, o null si nunca.'),
  })
  .describe('Instalación de un juego en esta máquina.');

const gameSchema = z
  .object({
    appId: z.number().int().positive().describe('AppID de Steam.'),
    name: z.string().describe('Nombre del juego.'),
    installation: installationSchema.nullable().describe('null si no está instalado.'),
  })
  .describe('Un juego conocido por Y-CORE.');

const list = defineChannel(
  z.object({}).describe('Sin filtros por ahora: devuelve toda la biblioteca conocida.'),
  z.object({ games: z.array(gameSchema).describe('Todos los juegos conocidos.') })
    .describe('La biblioteca completa.'),
);

const launch = defineChannel(
  z.object({ appId: z.number().int().positive().describe('AppID del juego a lanzar.') })
    .describe('Lanza un juego instalado.'),
  z.object({ pid: z.number().int().describe('PID del proceso lanzado.') })
    .describe('El proceso quedó lanzado.'),
);

/** Canales del namespace `library.*`. */
export const libraryChannels = {
  'library.list': list,
  'library.launch': launch,
};
