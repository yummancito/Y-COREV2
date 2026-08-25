import { describe, expect, it } from 'vitest';
import { ProgressThrottle } from './progress-throttle.js';

describe('ProgressThrottle', () => {
  it('emite la primera muestra siempre, sin esperar el intervalo', () => {
    const throttle = new ProgressThrottle();

    const emitted = throttle.sample({ bytesDownloaded: 100, bytesTotal: 1000 }, 0);

    expect(emitted).toEqual({ bytesDownloaded: 100, bytesTotal: 1000 });
  });

  it('1000 muestras repartidas en 1 s emiten como máximo 4 (una cada 250 ms)', () => {
    const throttle = new ProgressThrottle();
    let emittedCount = 0;

    for (let ms = 0; ms < 1000; ms += 1) {
      const emitted = throttle.sample({ bytesDownloaded: ms, bytesTotal: 1000 }, ms);
      if (emitted !== null) emittedCount += 1;
    }

    expect(emittedCount).toBe(4);
  });

  it('una muestra que llega dentro de la ventana queda pendiente, no se pierde', () => {
    const throttle = new ProgressThrottle();
    throttle.sample({ bytesDownloaded: 0, bytesTotal: 1000 }, 0);

    const emitted = throttle.sample({ bytesDownloaded: 50, bytesTotal: 1000 }, 100);

    expect(emitted).toBeNull();
    expect(throttle.flush()).toEqual({ bytesDownloaded: 50, bytesTotal: 1000 });
  });

  it('flush() no tiene nada que devolver si no hay ninguna muestra pendiente', () => {
    const throttle = new ProgressThrottle();
    throttle.sample({ bytesDownloaded: 0, bytesTotal: 1000 }, 0);

    expect(throttle.flush()).toBeNull();
  });

  it('flush() solo devuelve la muestra pendiente una vez', () => {
    const throttle = new ProgressThrottle();
    throttle.sample({ bytesDownloaded: 0, bytesTotal: 1000 }, 0);
    throttle.sample({ bytesDownloaded: 10, bytesTotal: 1000 }, 50);

    expect(throttle.flush()).toEqual({ bytesDownloaded: 10, bytesTotal: 1000 });
    expect(throttle.flush()).toBeNull();
  });

  it('tras pasar el intervalo, la siguiente muestra se emite y ya no queda pendiente', () => {
    const throttle = new ProgressThrottle();
    throttle.sample({ bytesDownloaded: 0, bytesTotal: 1000 }, 0);
    throttle.sample({ bytesDownloaded: 10, bytesTotal: 1000 }, 100);

    const emitted = throttle.sample({ bytesDownloaded: 20, bytesTotal: 1000 }, 260);

    expect(emitted).toEqual({ bytesDownloaded: 20, bytesTotal: 1000 });
    expect(throttle.flush()).toBeNull();
  });
});
