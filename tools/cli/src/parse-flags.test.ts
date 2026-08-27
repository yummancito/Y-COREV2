import { describe, expect, it } from 'vitest';
import { parseFlags, requireString, requireNumber, readBoolean } from './parse-flags.js';

describe('parseFlags', () => {
  it('parsea --clave valor', () => {
    expect(parseFlags(['--version', '5.1.0', '--channel', 'stable'])).toEqual({ version: '5.1.0', channel: 'stable' });
  });

  it('trata un flag sin valor siguiente como booleano true', () => {
    expect(parseFlags(['--mandatory'])).toEqual({ mandatory: true });
  });

  it('trata un flag seguido de otro flag como booleano true', () => {
    expect(parseFlags(['--on', '--note', 'x'])).toEqual({ on: true, note: 'x' });
  });

  it('ignora tokens que no empiezan con --', () => {
    expect(parseFlags(['ruido', '--version', '5.1.0'])).toEqual({ version: '5.1.0' });
  });
});

describe('requireString', () => {
  it('devuelve el valor si está presente', () => {
    expect(requireString({ version: '5.1.0' }, 'version')).toBe('5.1.0');
  });

  it('lanza si falta', () => {
    expect(() => requireString({}, 'version')).toThrow('--version');
  });

  it('lanza si el flag es booleano', () => {
    expect(() => requireString({ version: true }, 'version')).toThrow('--version');
  });
});

describe('requireNumber', () => {
  it('devuelve el número parseado', () => {
    expect(requireNumber({ rollout: '50' }, 'rollout')).toBe(50);
  });

  it('lanza si no es un número', () => {
    expect(() => requireNumber({ rollout: 'no-numero' }, 'rollout')).toThrow('--rollout');
  });
});

describe('readBoolean', () => {
  it('devuelve true si el flag está presente sin valor', () => {
    expect(readBoolean({ mandatory: true }, 'mandatory')).toBe(true);
  });

  it('devuelve true si el flag es el string "true"', () => {
    expect(readBoolean({ mandatory: 'true' }, 'mandatory')).toBe(true);
  });

  it('devuelve false si el flag no está presente', () => {
    expect(readBoolean({}, 'mandatory')).toBe(false);
  });
});
