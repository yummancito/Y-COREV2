/**
 * `assertSchemaIsDescribed` — verifica en runtime que un schema Zod (y cada
 * uno de sus campos, si es un objeto) tiene `.describe()`.
 *
 * Sirve como guardia de arranque: se llama una vez por cada schema exportado
 * (ver `src/index.ts`), así que un campo sin descripción rompe al importar
 * el módulo, no en silencio cuando alguien intente generar la documentación
 * semanas después. Es la versión de este paquete de `assertContractIsFullyDescribed`
 * de `packages/ipc-contract` — no se reutiliza esa porque `update-contract` no
 * puede depender de nada del repo (ADR-0005, punto 3.b: "cero I/O, cero
 * dependencias más allá de zod").
 */

import type { z } from 'zod';

/**
 * Recorre las claves de un `z.object` y lanza si alguna no tiene `.describe()`,
 * o si el propio schema no lo tiene.
 *
 * @param name - Nombre del schema, para el mensaje de error.
 * @param schema - El schema a verificar.
 * @throws Error de programación (no un `AppError`) si falta una descripción.
 *   Corre en tiempo de construcción del módulo, antes de que exista ninguna
 *   frontera que cruzar, así que no aplica la regla "prohibido throw cruzando
 *   fronteras".
 */
export function assertSchemaIsDescribed(name: string, schema: z.ZodType): void {
  if (!schema.description) {
    throw new Error(`Schema "${name}": falta .describe() en el schema raíz.`);
  }

  const shape = (schema as { shape?: Record<string, z.ZodType> }).shape;
  if (shape === undefined) return;

  for (const [field, fieldSchema] of Object.entries(shape)) {
    if (!fieldSchema.description) {
      throw new Error(`Schema "${name}": el campo "${field}" no tiene .describe().`);
    }
  }
}
