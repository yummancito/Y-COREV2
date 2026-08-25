import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { parseDepotKeys } from './depot-keys.js';

describe('parseDepotKeys — caso feliz', () => {
  it('extrae varias claves de depot desde la forma real anidada bajo Steam', () => {
    const vdf = `
      "InstallConfigStore"
      {
        "Software"
        {
          "Valve"
          {
            "Steam"
            {
              "depots"
              {
                "731"
                {
                  "DecryptionKey"		"aabbccddeeff00112233445566778899"
                }
                "732"
                {
                  "DecryptionKey"		"1122334455667788990011223344556"
                }
              }
            }
          }
        }
      }
    `;
    const result = parseDepotKeys(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.get('731')).toBe('aabbccddeeff00112233445566778899');
      expect(result.value.get('732')).toBe('1122334455667788990011223344556');
      expect(result.value.size).toBe(2);
    }
  });

  it('devuelve un mapa vacío si config.vdf no tiene sección depots todavía (instalación nueva)', () => {
    const vdf = `
      "InstallConfigStore"
      {
        "Software"
        {
          "Valve"
          {
            "Steam"
            {
              "AutoUpdateWindowEnabled"		"1"
            }
          }
        }
      }
    `;
    const result = parseDepotKeys(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.size).toBe(0);
  });
});

describe('parseDepotKeys — casos límite', () => {
  it('ignora depots sin DecryptionKey (Steam Store API no siempre devuelve todas)', () => {
    const vdf = `
      "Steam"
      {
        "depots"
        {
          "731" { "DecryptionKey" "aabbcc" }
          "999" { "manifest" "sin-clave-de-verdad" }
        }
      }
    `;
    const result = parseDepotKeys(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.size).toBe(1);
      expect(result.value.has('999')).toBe(false);
    }
  });

  it('propaga AppError io.failed si el VDF es inválido', () => {
    const result = parseDepotKeys('"Steam"\n{\n\t"depots"');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('io.failed');
  });
});
