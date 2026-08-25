/**
 * `assertContractIsFullyDescribed` — verifica en runtime que todo canal del
 * contrato tiene `.describe()` en su input y su output.
 *
 * Sirve como guardia de arranque: se llama una vez al construir el `contract`
 * (ver `src/index.ts`), así que un canal sin descripción rompe el proceso
 * inmediatamente al importar el módulo, no en silencio cuando alguien intente
 * generar `ipc-channels.md` semanas después.
 */

import type { ChannelDefinition } from './channel.js';

/**
 * Recorre un mapa de canales y lanza si alguno no tiene `.describe()` en
 * input u output.
 *
 * @param channels - Mapa `nombre de canal → ChannelDefinition`.
 * @throws Error de programación (no un `AppError`) si falta una descripción.
 *   Es intencional que lance: esto corre en tiempo de construcción del
 *   contrato, antes de que exista ninguna frontera que cruzar, así que no
 *   aplica la regla "prohibido throw cruzando fronteras".
 */
export function assertContractIsFullyDescribed(
  channels: Readonly<Record<string, ChannelDefinition>>,
): void {
  for (const [name, def] of Object.entries(channels)) {
    if (!def.input.description) {
      throw new Error(`Canal "${name}": el schema de input no tiene .describe().`);
    }
    if (!def.output.description) {
      throw new Error(`Canal "${name}": el schema de output no tiene .describe().`);
    }
  }
}
