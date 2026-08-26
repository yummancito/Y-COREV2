import { describe, expect, it } from 'vitest';
import { signCheckRequest } from './sign-request.js';

describe('signCheckRequest', () => {
  it('es determinista: los mismos datos producen siempre la misma firma', async () => {
    const first = await signCheckRequest('secret', 'client-1', '5.0.0', 'stable');
    const second = await signCheckRequest('secret', 'client-1', '5.0.0', 'stable');
    expect(first).toBe(second);
  });

  it('produce una firma distinta si cambia cualquier dato', async () => {
    const base = await signCheckRequest('secret', 'client-1', '5.0.0', 'stable');
    const otherVersion = await signCheckRequest('secret', 'client-1', '5.9.9', 'stable');
    const otherSecret = await signCheckRequest('otro-secreto', 'client-1', '5.0.0', 'stable');

    expect(otherVersion).not.toBe(base);
    expect(otherSecret).not.toBe(base);
  });

  it('produce un string hexadecimal de 64 caracteres (SHA-256)', async () => {
    const signature = await signCheckRequest('secret', 'client-1', '5.0.0', 'stable');
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });
});
