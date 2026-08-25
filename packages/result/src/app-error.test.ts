import { describe, expect, it } from 'vitest';
import { appError, fromUnknown } from './app-error.js';

describe('appError', () => {
  it('marca como retriable los códigos que admiten reintento', () => {
    expect(appError('net.unreachable').retriable).toBe(true);
    expect(appError('io.failed').retriable).toBe(true);
  });

  it('marca como no retriable el resto de códigos', () => {
    expect(appError('not-found').retriable).toBe(false);
    expect(appError('ipc.invalid-input').retriable).toBe(false);
  });

  it('permite forzar retriable explícitamente', () => {
    expect(appError('not-found', { retriable: true }).retriable).toBe(true);
    expect(appError('net.unreachable', { retriable: false }).retriable).toBe(false);
  });

  it('omite context y detail cuando no se pasan, en vez de ponerlos undefined', () => {
    const error = appError('unknown');
    expect('context' in error).toBe(false);
    expect('detail' in error).toBe(false);
  });

  it('conserva context y detail cuando se pasan', () => {
    const error = appError('not-found', { context: { appId: 730 }, detail: 'sin manifest' });
    expect(error.context).toEqual({ appId: 730 });
    expect(error.detail).toBe('sin manifest');
  });

  it('produce un objeto plano que sobrevive a la serialización del puente IPC', () => {
    const error = appError('io.failed', { context: { path: 'C:/x' } });
    expect(JSON.parse(JSON.stringify(error))).toEqual(error);
  });
});

describe('fromUnknown', () => {
  it('extrae nombre y mensaje de un Error', () => {
    const error = fromUnknown(new TypeError('algo raro'));
    expect(error.code).toBe('unknown');
    expect(error.retriable).toBe(false);
    expect(error.detail).toBe('TypeError: algo raro');
  });

  it('acepta un string lanzado tal cual', () => {
    expect(fromUnknown('boom').detail).toBe('boom');
  });

  it('serializa cualquier otro valor lanzado', () => {
    expect(fromUnknown({ raro: true }).detail).toBe('{"raro":true}');
  });
});
