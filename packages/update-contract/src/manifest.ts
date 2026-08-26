/**
 * `ManifestSchema` — el manifest de una release, firmado con Ed25519 fuera
 * del Worker (ADR-0005, punto 5: la firma se hace en el pipeline de CI, el
 * Worker solo almacena y sirve el resultado ya firmado).
 *
 * Sirve como la forma exacta que `tools/scripts/` firma en `release-desktop.yml`
 * y que el Worker guarda en R2 junto al instalador — nunca se reconstruye ni
 * se re-firma en ningún otro lado.
 */

import { z } from 'zod';

export const ManifestSchema = z
  .object({
    version: z.string().describe('Versión de esta release, semver.'),
    channel: z.enum(['stable', 'beta']).describe('Canal al que pertenece.'),
    sha512: z.string().describe('Hash SHA-512 del instalador completo, en hexadecimal.'),
    size: z.number().int().positive().describe('Tamaño del instalador completo, en bytes.'),
    blockmapSha512: z.string().nullable().describe('Hash SHA-512 del .blockmap, o null si no se generó.'),
    notes: z
      .object({ es: z.string().describe('Notas en español.'), en: z.string().describe('Notas en inglés.') })
      .describe('Notas de la release, por idioma.'),
    signature: z.string().describe('Firma Ed25519 (base64) de este manifest, hecha por el pipeline de CI.'),
  })
  .describe('Manifest firmado de una release, tal como se sube a R2 junto al instalador.');

export type Manifest = z.infer<typeof ManifestSchema>;
