import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { parseVdf } from './parse-vdf.js';
import { childValue, findChild, findChildren } from './vdf-node.js';

describe('parseVdf — casos básicos', () => {
  it('parsea un par clave-valor simple', () => {
    const result = parseVdf('"key" "value"');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(childValue(result.value, 'key')).toBe('value');
  });

  it('parsea una sección anidada', () => {
    const result = parseVdf('"AppState"\n{\n\t"appid"\t\t"730"\n}');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const appState = findChild(result.value, 'AppState');
      expect(appState).toBeDefined();
      expect(childValue(appState!, 'appid')).toBe('730');
    }
  });

  it('parsea anidamiento profundo (MountedDepots real de un appmanifest)', () => {
    const vdf = `
      "AppState"
      {
        "appid" "240"
        "MountedDepots"
        {
          "100" "111"
          "200" "222"
        }
      }
    `;
    const result = parseVdf(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const appState = findChild(result.value, 'AppState')!;
      const mounted = findChild(appState, 'MountedDepots')!;
      expect(childValue(mounted, '100')).toBe('111');
      expect(childValue(mounted, '200')).toBe('222');
    }
  });

  it('un valor vacío es válido', () => {
    const result = parseVdf('"key" ""');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(childValue(result.value, 'key')).toBe('');
  });
});

describe('parseVdf — edge cases reales del v1 (comentarios FIX del roadmap)', () => {
  it('ignora comentarios de línea //', () => {
    const vdf = `
      // comentario suelto
      "key" "value" // comentario al final de la línea
      "otra" "cosa"
    `;
    const result = parseVdf(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(childValue(result.value, 'key')).toBe('value');
      expect(childValue(result.value, 'otra')).toBe('cosa');
    }
  });

  it('resuelve escapes \\" \\\\ \\n \\t \\r dentro de strings entre comillas', () => {
    const vdf = String.raw`"key" "linea1\nlinea2\tcon-tab\\barra\"comilla"`;
    const result = parseVdf(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(childValue(result.value, 'key')).toBe('linea1\nlinea2\tcon-tab\\barra"comilla');
    }
  });

  it('acepta tokens sin comillas (bareword), comunes en archivos reales de Steam', () => {
    const result = parseVdf('key value');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(childValue(result.value, 'key')).toBe('value');
  });

  it('preserva claves duplicadas dentro de una sección como entradas separadas (semántica real de Valve)', () => {
    const vdf = `
      "libraryfolders"
      {
        "0" { "path" "C:\\\\Steam" }
        "0" { "path" "D:\\\\SteamLibrary" }
      }
    `;
    const result = parseVdf(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const libraryFolders = findChild(result.value, 'libraryfolders')!;
      const entries = findChildren(libraryFolders, '0');
      expect(entries).toHaveLength(2);
    }
  });

  it('las claves de sección no distinguen mayúsculas de minúsculas (AppState vs appstate)', () => {
    const result = parseVdf('"appstate"\n{\n\t"appid" "730"\n}');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const appState = findChild(result.value, 'AppState');
      expect(appState).toBeDefined();
    }
  });
});

describe('parseVdf — errores estructurales (archivo hostil/corrupto)', () => {
  it('rechaza anidamiento más allá del límite de profundidad (archivo hostil/corrupto)', () => {
    const opens = '"a"\n{\n'.repeat(65);
    const closes = '}\n'.repeat(65);
    const result = parseVdf(opens + closes);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('io.failed');
  });

  it('devuelve AppError io.failed ante llaves desbalanceadas', () => {
    const result = parseVdf('"key"\n{\n\t"a" "b"\n');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('io.failed');
  });

  it('devuelve AppError io.failed si una clave no tiene valor ni sección', () => {
    const result = parseVdf('"key"');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('io.failed');
  });
});

describe('parseVdf — appmanifest real completo', () => {
  it('parsea un appmanifest_*.acf con la forma real de Steam', () => {
    const acf = `
      "AppState"
      {
        "appid"		"240"
        "Universe"		"1"
        "name"		"Source SDK Base 2007"
        "StateFlags"		"4"
        "installdir"		"Source SDK Base 2007"
        "InstalledDepots"
        {
          "456"
          {
            "manifest"		"1234567890123456789"
          }
        }
        "UserConfig"
        {
          "Language"		"english"
        }
      }
    `;
    const result = parseVdf(acf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const appState = findChild(result.value, 'AppState')!;
      expect(childValue(appState, 'appid')).toBe('240');
      expect(childValue(appState, 'name')).toBe('Source SDK Base 2007');

      const depots = findChild(appState, 'InstalledDepots')!;
      const depot456 = findChild(depots, '456')!;
      expect(childValue(depot456, 'manifest')).toBe('1234567890123456789');

      const userConfig = findChild(appState, 'UserConfig')!;
      expect(childValue(userConfig, 'Language')).toBe('english');
    }
  });
});
