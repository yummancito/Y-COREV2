/**
 * `parseLoginUsers` — resuelve el SteamID64 activo desde `config/loginusers.vdf`.
 *
 * Sirve para saber de qué usuario leer la biblioteca cuando la máquina tiene
 * varias cuentas de Steam usadas alguna vez — `loginusers.vdf` registra todas
 * las que iniciaron sesión, marcando `MostRecent` en la última.
 */

import { err, ok, type Result } from '@ycore/result';
import { appError, type AppError } from '@ycore/result/app-error';
import { parseVdf } from './vdf/parse-vdf.js';
import { childValue, findChild } from './vdf/vdf-node.js';

/**
 * @param vdfContent - Contenido crudo de `config/loginusers.vdf`, ya leído.
 * @returns El SteamID64 (como string — son enteros de 64 bits, no caben
 *   seguros en `number`) de la cuenta marcada `MostRecent`, o de la primera
 *   cuenta listada si ninguna lo está. `AppError` `not-found` si el archivo
 *   no lista ninguna cuenta.
 */
export function parseLoginUsers(vdfContent: string): Result<string, AppError> {
  const parsedResult = parseVdf(vdfContent);
  if (parsedResult.ok === false) return parsedResult;

  const users = findChild(parsedResult.value, 'users');
  const accounts = users?.children ?? [];
  if (accounts.length === 0) {
    return err(appError('not-found', { detail: 'loginusers.vdf no lista ninguna cuenta' }));
  }

  const mostRecent = accounts.find((account) => childValue(account, 'MostRecent') === '1');
  return ok((mostRecent ?? accounts[0]!).key);
}
