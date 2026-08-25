import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { parseLibraryFolders } from './library-folders.js';

describe('parseLibraryFolders — formato moderno (sección con .path)', () => {
  it('extrae la ruta de una única biblioteca', () => {
    const vdf = `
      "libraryfolders"
      {
        "0"
        {
          "path"		"C:\\\\Program Files (x86)\\\\Steam"
          "label"		""
          "contentid"		"1234567890"
          "totalsize"		"500107862016"
          "update_clean_bytes_tally"		"0"
          "apps"
          {
            "480"		"123456789"
          }
        }
      }
    `;
    const result = parseLibraryFolders(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual(['C:\\Program Files (x86)\\Steam']);
  });

  it('extrae varias bibliotecas en orden', () => {
    const vdf = `
      "libraryfolders"
      {
        "0" { "path" "C:\\\\Steam" }
        "1" { "path" "D:\\\\SteamLibrary" }
        "2" { "path" "E:\\\\Games\\\\Steam" }
      }
    `;
    const result = parseLibraryFolders(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual(['C:\\Steam', 'D:\\SteamLibrary', 'E:\\Games\\Steam']);
    }
  });

  it('ignora las claves contentroot y packages (no son bibliotecas)', () => {
    const vdf = `
      "libraryfolders"
      {
        "0" { "path" "C:\\\\Steam" }
        "contentroot" "C:\\\\Steam\\\\content"
        "packages" "C:\\\\Steam\\\\package"
      }
    `;
    const result = parseLibraryFolders(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual(['C:\\Steam']);
  });
});

describe('parseLibraryFolders — formato viejo (valor directo)', () => {
  it('extrae la ruta cuando la entrada es un valor plano, no una sección', () => {
    const vdf = `
      "libraryfolders"
      {
        "0"		"C:\\\\Steam"
        "1"		"D:\\\\SteamLibrary"
      }
    `;
    const result = parseLibraryFolders(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual(['C:\\Steam', 'D:\\SteamLibrary']);
  });
});

describe('parseLibraryFolders — casos límite', () => {
  it('devuelve un array vacío si no hay ninguna biblioteca declarada (no es un error)', () => {
    const result = parseLibraryFolders('"libraryfolders"\n{\n}');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual([]);
  });

  it('devuelve un array vacío si falta la sección libraryfolders por completo', () => {
    const result = parseLibraryFolders('"otracosa" "valor"');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual([]);
  });

  it('ignora entradas de biblioteca sin .path resoluble', () => {
    const vdf = `
      "libraryfolders"
      {
        "0" { "label" "sin ruta" }
        "1" { "path" "D:\\\\SteamLibrary" }
      }
    `;
    const result = parseLibraryFolders(vdf);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual(['D:\\SteamLibrary']);
  });

  it('propaga AppError si el VDF es inválido', () => {
    const result = parseLibraryFolders('"libraryfolders"\n{\n\t"0"');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('io.failed');
  });
});
