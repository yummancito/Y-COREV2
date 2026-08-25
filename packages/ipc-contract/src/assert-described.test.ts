import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assertContractIsFullyDescribed } from './assert-described.js';
import { defineChannel } from './channel.js';

describe('assertContractIsFullyDescribed', () => {
  it('no lanza si todos los canales tienen input y output descritos', () => {
    const channels = {
      'test.ok': defineChannel(
        z.object({}).describe('input descrito'),
        z.object({}).describe('output descrito'),
      ),
    };

    expect(() => assertContractIsFullyDescribed(channels)).not.toThrow();
  });

  it('lanza si el input de un canal no tiene .describe()', () => {
    const channels = {
      'test.sin-input': defineChannel(z.object({}), z.object({}).describe('output descrito')),
    };

    expect(() => assertContractIsFullyDescribed(channels)).toThrow(/input.*describe/i);
  });

  it('lanza si el output de un canal no tiene .describe()', () => {
    const channels = {
      'test.sin-output': defineChannel(z.object({}).describe('input descrito'), z.object({})),
    };

    expect(() => assertContractIsFullyDescribed(channels)).toThrow(/output.*describe/i);
  });

  it('el mensaje de error nombra el canal que falla', () => {
    const channels = {
      'library.launch': defineChannel(z.object({}), z.object({}).describe('output')),
    };

    expect(() => assertContractIsFullyDescribed(channels)).toThrow(/library\.launch/);
  });
});
