import { describe, expect, it } from 'vitest';
import { contract } from './index.js';

describe('contract', () => {
  it('incluye el canal de referencia app.ping', () => {
    expect(contract['app.ping']).toBeDefined();
  });

  it('todo canal tiene input y output descritos (verificado también en runtime al importar)', () => {
    for (const [name, channel] of Object.entries(contract)) {
      expect(channel.input.description, `${name}.input`).toBeTruthy();
      expect(channel.output.description, `${name}.output`).toBeTruthy();
    }
  });

  it('app.ping valida un payload vacío y devuelve pong', () => {
    const parsedInput = contract['app.ping'].input.safeParse({});
    expect(parsedInput.success).toBe(true);

    const parsedOutput = contract['app.ping'].output.safeParse({
      pong: true,
      receivedAt: new Date().toISOString(),
    });
    expect(parsedOutput.success).toBe(true);
  });
});
