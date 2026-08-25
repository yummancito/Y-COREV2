/**
 * Canales del namespace `steam.*` — integración con la instalación real de
 * Steam de esta máquina (Fase 3 del roadmap).
 *
 * Sirve para disparar la importación de la biblioteca real desde el
 * renderer (p. ej. un botón "Sincronizar con Steam"). El resultado no
 * devuelve los juegos en sí — eso se lee después con `library.list`, que ya
 * refleja los datos importados — solo cuántos se encontraron.
 */

import { z } from 'zod';
import { defineChannel } from '../channel.js';

const importLibrary = defineChannel(
  z.object({}).describe('Sin parámetros: escanea la instalación de Steam de esta máquina.'),
  z
    .object({
      gamesFound: z.number().int().nonnegative().describe('Cuántos juegos se encontraron instalados.'),
    })
    .describe('Resultado del escaneo. Los datos ya quedaron guardados; usa library.list para leerlos.'),
);

/** Canales del namespace `steam.*`. */
export const steamChannels = {
  'steam.importLibrary': importLibrary,
};
