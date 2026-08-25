import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineChannel } from './channel.js';

describe('defineChannel', () => {
  it('conserva los schemas de input y output tal cual se pasan', () => {
    const input = z.object({ appId: z.number() }).describe('input de prueba');
    const output = z.object({ pid: z.number() }).describe('output de prueba');

    const channel = defineChannel(input, output);

    expect(channel.input).toBe(input);
    expect(channel.output).toBe(output);
  });

  it('el resultado sigue siendo un schema Zod usable para parsear', () => {
    const channel = defineChannel(
      z.object({ appId: z.number().int().positive() }).describe('in'),
      z.object({ pid: z.number().int() }).describe('out'),
    );

    expect(channel.input.safeParse({ appId: 730 }).success).toBe(true);
    expect(channel.input.safeParse({ appId: -1 }).success).toBe(false);
    expect(channel.output.safeParse({ pid: 1234 }).success).toBe(true);
  });
});
