import { describe, expect, it, vi } from 'vitest';
import { ok } from '@ycore/result';
import { buildBridge, type InvokeChannel } from './build-bridge.js';

describe('buildBridge', () => {
  it('agrupa los canales por namespace y expone un método por verbo', () => {
    const invoke: InvokeChannel = vi.fn();
    const bridge = buildBridge(['library.launch', 'library.list', 'downloads.pause'] as never[], invoke);

    expect(Object.keys(bridge).sort()).toEqual(['downloads', 'library']);
    expect(typeof bridge['library']?.['launch']).toBe('function');
    expect(typeof bridge['library']?.['list']).toBe('function');
    expect(typeof bridge['downloads']?.['pause']).toBe('function');
  });

  it('cada método invocado llama a invoke con el nombre de canal completo y el payload', async () => {
    const invoke = vi.fn().mockResolvedValue(ok({ pid: 1 }));
    const bridge = buildBridge(['library.launch'] as never[], invoke as InvokeChannel);

    await (bridge['library']?.['launch'] as (p: unknown) => Promise<unknown>)({ appId: 730 });

    expect(invoke).toHaveBeenCalledWith('library.launch', { appId: 730 });
  });

  it('con una lista vacía de canales produce un árbol vacío', () => {
    const bridge = buildBridge([], vi.fn());
    expect(bridge).toEqual({});
  });

  it('nunca expone un método "invoke" genérico en la raíz del árbol (criterio de HECHO de Fase 1)', () => {
    const bridge = buildBridge(['library.launch', 'app.ping'] as never[], vi.fn());

    // El agujero de seguridad del v1 (ADR-0002): un invoke(channel, ...) que acepte
    // cualquier nombre de canal. Aquí "invoke" ni siquiera puede aparecer como
    // namespace real porque ningún canal se llama "invoke.<verbo>", pero el test
    // deja explícito que la propiedad no existe, no solo que no se usó por casualidad.
    expect(Object.hasOwn(bridge, 'invoke')).toBe(false);
  });
});
