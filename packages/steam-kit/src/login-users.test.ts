import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { parseLoginUsers } from './login-users.js';

describe('parseLoginUsers', () => {
  it('devuelve el SteamID64 marcado MostRecent cuando hay varias cuentas', () => {
    const vdf = `
      "users"
      {
        "76561197960287930"
        {
          "AccountName"		"cuentavieja"
          "PersonaName"		"Jugador Viejo"
          "MostRecent"		"0"
          "Timestamp"		"1600000000"
        }
        "76561198012345678"
        {
          "AccountName"		"cuentaactual"
          "PersonaName"		"Jugador Actual"
          "MostRecent"		"1"
          "Timestamp"		"1700000000"
        }
      }
    `;
    const result = parseLoginUsers(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('76561198012345678');
  });

  it('cae a la primera cuenta si ninguna tiene MostRecent=1 (caso raro pero real)', () => {
    const vdf = `
      "users"
      {
        "76561197960287930"
        {
          "AccountName"		"unicacuenta"
          "MostRecent"		"0"
        }
      }
    `;
    const result = parseLoginUsers(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe('76561197960287930');
  });

  it('devuelve AppError not-found si no hay ninguna cuenta listada', () => {
    const result = parseLoginUsers('"users"\n{\n}');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('devuelve AppError not-found si falta la sección users por completo', () => {
    const result = parseLoginUsers('"otracosa" "valor"');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('not-found');
  });

  it('propaga AppError io.failed si el VDF es inválido', () => {
    const result = parseLoginUsers('"users"\n{\n\t"123"');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('io.failed');
  });
});
