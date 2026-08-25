import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createLogger } from './index.js';

type ConsoleSpy = MockInstance<(...args: unknown[]) => void>;

/** Extrae el primer argumento de la última llamada a un spy de console.* como string. */
function primerArgumentoDe(spy: ConsoleSpy): string {
  const [line] = spy.mock.calls[0] ?? [];
  if (typeof line !== 'string') throw new Error('el spy no fue llamado con un string');
  return line;
}

describe('createLogger — niveles y umbral', () => {
  let logSpy: ConsoleSpy;
  let warnSpy: ConsoleSpy;
  let errorSpy: ConsoleSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('info/debug van a console.log, warn a console.warn, error a console.error', () => {
    const log = createLogger('test:scope', { threshold: 'debug' });
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('descarta eventos por debajo del umbral configurado', () => {
    const log = createLogger('test:scope', { threshold: 'warn' });
    log.debug('no debería emitirse');
    log.info('no debería emitirse');
    log.warn('sí debería emitirse');

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('incluye el mensaje y el scope en la línea emitida', () => {
    const log = createLogger('main:library', { threshold: 'debug' });
    log.info('juego lanzado', { appId: 730 });

    const line = primerArgumentoDe(logSpy);
    expect(line).toContain('main:library');
    expect(line).toContain('juego lanzado');
    expect(line).toContain('730');
  });
});

describe('createLogger — child()', () => {
  it('concatena el scope hijo al scope del padre', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createLogger('main', { threshold: 'debug' }).child('library');
    log.info('mensaje');

    const line = primerArgumentoDe(logSpy);
    expect(line).toContain('main:library');
    logSpy.mockRestore();
  });
});

describe('createLogger — robustez ante contexto no serializable', () => {
  it('no lanza si el contexto tiene una referencia circular', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createLogger('test', { threshold: 'debug' });

    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    expect(() => log.info('mensaje', circular)).not.toThrow();
    expect(logSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });
});
