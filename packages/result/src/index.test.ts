import { describe, expect, it } from 'vitest';
import {
  err,
  flatMap,
  fromPromise,
  fromThrowable,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  unwrapOr,
} from './index.js';

describe('constructores y type guards', () => {
  it('ok() produce una rama de éxito que isOk reconoce', () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (isOk(result)) expect(result.value).toBe(42);
  });

  it('err() produce una rama de fallo que isErr reconoce', () => {
    const result = err('boom');
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    if (isErr(result)) expect(result.error).toBe('boom');
  });
});

describe('map', () => {
  it('transforma el valor cuando es Ok', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
  });

  it('deja el error intacto y no ejecuta la función cuando es Err', () => {
    let llamada = false;
    const result = map(err<string>('boom'), (n: number) => {
      llamada = true;
      return n;
    });
    expect(result).toEqual(err('boom'));
    expect(llamada).toBe(false);
  });
});

describe('flatMap', () => {
  it('encadena operaciones exitosas', () => {
    expect(flatMap(ok(2), (n) => ok(n + 1))).toEqual(ok(3));
  });

  it('cortocircuita en el primer fallo', () => {
    expect(flatMap(err<string>('primero'), () => ok(1))).toEqual(err('primero'));
  });

  it('propaga un fallo producido por la función encadenada', () => {
    expect(flatMap(ok(2), () => err('segundo'))).toEqual(err('segundo'));
  });
});

describe('mapErr', () => {
  it('transforma el error cuando es Err', () => {
    expect(mapErr(err(404), (c) => `código ${c}`)).toEqual(err('código 404'));
  });

  it('deja el valor intacto cuando es Ok', () => {
    expect(mapErr(ok('bien'), () => 'otro')).toEqual(ok('bien'));
  });
});

describe('unwrapOr', () => {
  it('devuelve el valor cuando es Ok', () => {
    expect(unwrapOr(ok(1), 99)).toBe(1);
  });

  it('devuelve el fallback cuando es Err', () => {
    expect(unwrapOr(err<string>('boom'), 99)).toBe(99);
  });
});

describe('fromThrowable', () => {
  it('captura el valor cuando la función no lanza', () => {
    const parseJson = (raw: string): unknown => JSON.parse(raw);
    expect(fromThrowable(() => parseJson('{"a":1}'), () => 'parse-error')).toEqual(
      ok({ a: 1 }),
    );
  });

  it('convierte la excepción en Err en vez de propagarla', () => {
    const parseJson = (raw: string): unknown => JSON.parse(raw);
    const result = fromThrowable(
      () => parseJson('no es json'),
      () => 'parse-error',
    );
    expect(result).toEqual(err('parse-error'));
  });
});

describe('fromPromise', () => {
  it('captura el valor de una promesa resuelta', async () => {
    await expect(fromPromise(Promise.resolve('bien'), () => 'fallo')).resolves.toEqual(
      ok('bien'),
    );
  });

  it('convierte el rechazo en Err sin propagarlo', async () => {
    await expect(
      fromPromise(Promise.reject(new Error('boom')), (e) => (e as Error).message),
    ).resolves.toEqual(err('boom'));
  });
});
