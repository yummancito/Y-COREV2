/**
 * `parseVdf` — parsea texto en formato VDF (Valve Data Format / KeyValues).
 *
 * Sirve para leer `libraryfolders.vdf`, `appmanifest_*.acf`, `config.vdf` y
 * `loginusers.vdf` sin tocar disco: recibe el contenido ya leído, nunca una
 * ruta (roadmap, sección A.3 — "steam-kit no importa Electron ni node:fs").
 *
 * VDF es un formato de árbol de pares clave-valor anidados, similar a JSON
 * pero sin comas ni corchetes de array — todo son objetos, y las claves
 * pueden repetirse dentro de una misma sección (Valve lo permite; Steam lo
 * usa para listar depots/apps con el mismo padre). Por eso el resultado no
 * es un objeto plano: cada sección es un array ordenado de `VdfNode`,
 * preservando duplicados y el orden original.
 *
 * @example
 * ```ts
 * const tree = parseVdf('"AppState"\n{\n\t"appid"\t\t"730"\n}');
 * // tree.children[0] = { key: 'AppState', children: [{ key: 'appid', value: '730' }] }
 * ```
 */

import { err, ok, type Result } from '@ycore/result';
import { appError, type AppError } from '@ycore/result/app-error';

/** Un nodo del árbol VDF: hoja (`value` presente) o sección (`children` presente). */
export interface VdfNode {
  readonly key: string;
  readonly value?: string;
  readonly children?: readonly VdfNode[];
}

/** Límite de profundidad de anidamiento — evita recursión sin fondo con un archivo hostil/corrupto. */
const MAX_DEPTH = 64;

type TokenType = 'string' | 'brace-open' | 'brace-close';
interface Token {
  readonly type: TokenType;
  readonly value: string;
}

/** Resultado de leer un único token a partir de la posición `i`. `null` si hay que saltar (espacio/comentario). */
interface StepResult {
  readonly token: Token | null;
  readonly nextIndex: number;
}

/** Lee un único token (o decide saltar espacio/comentario) desde la posición `i`. */
function readNextStep(text: string, i: number): StepResult {
  const ch = text[i] as string;

  if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
    return { token: null, nextIndex: i + 1 };
  }
  if (ch === '/' && text[i + 1] === '/') {
    let j = i;
    while (j < text.length && text[j] !== '\n') j += 1;
    return { token: null, nextIndex: j };
  }
  if (ch === '{') return { token: { type: 'brace-open', value: '{' }, nextIndex: i + 1 };
  if (ch === '}') return { token: { type: 'brace-close', value: '}' }, nextIndex: i + 1 };
  if (ch === '"') {
    const { value, nextIndex } = readQuotedString(text, i + 1);
    return { token: { type: 'string', value }, nextIndex };
  }

  // Bareword: token sin comillas, termina en espacio o llave.
  const { value, nextIndex } = readBareword(text, i);
  return { token: { type: 'string', value }, nextIndex };
}

/**
 * Tokeniza el texto VDF: strings entre comillas (con escapes `\" \\ \n \t \r`),
 * tokens sin comillas (bareword, común en archivos reales de Steam), y llaves
 * de sección. Los comentarios `//` de línea se descartan.
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    const { token, nextIndex } = readNextStep(text, i);
    if (token !== null) tokens.push(token);
    i = nextIndex;
  }

  return tokens;
}

function readQuotedString(text: string, start: number): { value: string; nextIndex: number } {
  let result = '';
  let i = start;
  while (i < text.length && text[i] !== '"') {
    if (text[i] === '\\' && i + 1 < text.length) {
      const next = text[i + 1];
      result += next === 'n' ? '\n' : next === 't' ? '\t' : next === 'r' ? '\r' : next;
      i += 2;
    } else {
      result += text[i];
      i += 1;
    }
  }
  return { value: result, nextIndex: i + 1 };
}

function readBareword(text: string, start: number): { value: string; nextIndex: number } {
  let i = start;
  while (i < text.length && !/[\s{}]/.test(text[i] as string)) i += 1;
  return { value: text.slice(start, i), nextIndex: i };
}

/** Construye los hijos de una sección consumiendo tokens hasta la llave de cierre. */
function parseChildren(tokens: readonly Token[], startIndex: number, depth: number): { children: VdfNode[]; nextIndex: number } {
  if (depth > MAX_DEPTH) throw new Error(`VDF anidado más allá de ${MAX_DEPTH} niveles`);

  const children: VdfNode[] = [];
  let i = startIndex;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token === undefined) break;
    if (token.type === 'brace-close') {
      return { children, nextIndex: i + 1 };
    }
    if (token.type !== 'string') {
      throw new Error(`token inesperado en la posición ${i}: ${token.type}`);
    }

    const key = token.value;
    const next = tokens[i + 1];

    if (next?.type === 'brace-open') {
      const nested = parseChildren(tokens, i + 2, depth + 1);
      children.push({ key, children: nested.children });
      i = nested.nextIndex;
    } else if (next?.type === 'string') {
      children.push({ key, value: next.value });
      i += 2;
    } else {
      throw new Error(`clave "${key}" sin valor ni sección en la posición ${i}`);
    }
  }

  // Se acabaron los tokens sin encontrar el brace-close correspondiente. A
  // nivel raíz (depth 0) esto es correcto — no hay llave de apertura que
  // cerrar. En cualquier nivel anidado es un archivo con llaves
  // desbalanceadas.
  if (depth > 0) {
    throw new Error('llave de sección sin cerrar (fin de archivo inesperado)');
  }
  return { children, nextIndex: i };
}

/**
 * Parsea texto VDF a un árbol de {@link VdfNode}.
 *
 * @param text - Contenido crudo del archivo `.vdf`/`.acf`, ya leído.
 * @returns La raíz sintética (`children` = las secciones de nivel superior),
 *   o `AppError` `io.failed` si el texto no es VDF válido (llaves
 *   desbalanceadas, clave sin valor, anidamiento excesivo).
 */
export function parseVdf(text: string): Result<VdfNode, AppError> {
  try {
    const tokens = tokenize(text);
    const { children } = parseChildren(tokens, 0, 0);
    return ok({ key: '', children });
  } catch (error) {
    return err(
      appError('io.failed', {
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
