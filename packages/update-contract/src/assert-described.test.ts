import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assertSchemaIsDescribed } from './assert-described.js';

describe('assertSchemaIsDescribed', () => {
  it('no lanza si el schema y todos sus campos tienen .describe()', () => {
    const schema = z.object({ a: z.string().describe('campo a') }).describe('schema completo');
    expect(() => assertSchemaIsDescribed('Test', schema)).not.toThrow();
  });

  it('lanza si el schema raíz no tiene .describe()', () => {
    const schema = z.object({ a: z.string().describe('campo a') });
    expect(() => assertSchemaIsDescribed('Test', schema)).toThrow(/schema raíz/);
  });

  it('lanza si un campo no tiene .describe()', () => {
    const schema = z.object({ a: z.string() }).describe('schema completo');
    expect(() => assertSchemaIsDescribed('Test', schema)).toThrow(/campo "a"/);
  });

  it('no exige recorrer campos en un schema sin shape (p. ej. una unión discriminada)', () => {
    const schema = z
      .discriminatedUnion('kind', [z.object({ kind: z.literal('a') }), z.object({ kind: z.literal('b') })])
      .describe('unión');
    expect(() => assertSchemaIsDescribed('Test', schema)).not.toThrow();
  });
});
