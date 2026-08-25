/**
 * `defineChannel` — construye la definición de un único canal IPC.
 *
 * Sirve para que declarar un canal sea una sola llamada con inferencia de tipos
 * completa (el TS de `input`/`output` sale del propio schema Zod, nunca se escribe
 * a mano), en vez de un objeto suelto que main/preload/renderer podrían tipar cada
 * uno a su manera y desincronizarse — que es justo el problema que describe
 * ADR-0002: "los tipos mienten en cuanto el payload cruza el puente".
 *
 * Exige `.describe()` en ambos schemas: sin descripción, `docs/02-features/<x>/
 * ipc-channels.md` no puede generarse (regla de documentación de .claude/CLAUDE.md).
 *
 * La garantía de "está descrito" se hace cumplir en runtime, no en el tipo estático:
 * `.describe()` de Zod v4 devuelve el mismo tipo del schema (no lo estrecha), así
 * que no hay forma honesta de exigirlo solo con tipos. `assertContractIsFullyDescribed`
 * (ver assert-described.ts) es quien de verdad bloquea un canal sin descripción,
 * lanzando al construirse el contrato.
 */

import type { z } from 'zod';

/** Cualquier schema Zod. `description` puede o no estar presente en runtime. */
export type DescribedSchema = z.ZodType;

/** Definición completa de un canal: sus dos schemas Zod, ya descritos. */
export interface ChannelDefinition<
  TInput extends DescribedSchema = DescribedSchema,
  TOutput extends DescribedSchema = DescribedSchema,
> {
  readonly input: TInput;
  readonly output: TOutput;
}

/**
 * Construye una {@link ChannelDefinition}, verificando en runtime que ambos
 * schemas tienen `.describe()`. La verificación en runtime (no solo en tipos)
 * importa porque el generador de `ipc-channels.md` lee `description` en
 * ejecución, no en tiempo de compilación.
 *
 * @param input - Schema Zod del payload que manda el renderer. Debe llevar `.describe()`.
 * @param output - Schema Zod de lo que devuelve el handler en su rama `ok`. Debe llevar `.describe()`.
 * @returns La definición del canal, lista para el registro del contrato.
 * @throws Nunca — si falta `.describe()`, es un error de programación que se
 *   detecta con `assertChannelIsDescribed` en tiempo de construcción del contrato,
 *   no en el momento de invocar el canal.
 *
 * @example
 * ```ts
 * const launch = defineChannel(
 *   z.object({ appId: z.number().int().positive() }).describe('Lanza un juego instalado'),
 *   z.object({ pid: z.number().int() }).describe('Proceso resultante'),
 * );
 * ```
 */
export function defineChannel<TInput extends DescribedSchema, TOutput extends DescribedSchema>(
  input: TInput,
  output: TOutput,
): ChannelDefinition<TInput, TOutput> {
  return { input, output };
}

/** Tipo TS del payload de entrada inferido desde el schema Zod del canal. */
export type ChannelInput<C extends ChannelDefinition> = z.infer<C['input']>;

/** Tipo TS del valor de éxito inferido desde el schema Zod de salida del canal. */
export type ChannelOutput<C extends ChannelDefinition> = z.infer<C['output']>;
