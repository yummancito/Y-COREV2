import { describe, expect, it } from 'vitest';
import { CheckRequestSchema, CheckResponseSchema } from './check.js';

const validRequest = {
  version: '5.0.0',
  channel: 'stable',
  platform: 'win32',
  arch: 'x64',
  clientId: '11111111-1111-4111-8111-111111111111',
};

describe('CheckRequestSchema', () => {
  it('acepta un request válido', () => {
    expect(CheckRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it('rechaza un clientId que no es un UUID', () => {
    expect(CheckRequestSchema.safeParse({ ...validRequest, clientId: 'no-es-uuid' }).success).toBe(false);
  });

  it('rechaza una plataforma distinta de win32', () => {
    expect(CheckRequestSchema.safeParse({ ...validRequest, platform: 'darwin' }).success).toBe(false);
  });
});

describe('CheckResponseSchema — up-to-date', () => {
  it('acepta la respuesta mínima de up-to-date', () => {
    const result = CheckResponseSchema.safeParse({ status: 'up-to-date', checkAgainInSeconds: 21600 });
    expect(result.success).toBe(true);
  });

  it('rechaza up-to-date sin checkAgainInSeconds', () => {
    expect(CheckResponseSchema.safeParse({ status: 'up-to-date' }).success).toBe(false);
  });
});
