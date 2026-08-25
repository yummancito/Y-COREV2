/**
 * `extractZip` — extrae un ZIP verificado a `installPath` de forma segura (ADR-0004, punto 8).
 *
 * Sirve como el único lugar de la feature que descomprime un archivo.
 * Usa `yauzl` (streaming, sin binarios nativos) en vez de un binario externo
 * (7z/RAR ya nos bloqueó Defender en el v1) o `adm-zip` (carga todo en
 * memoria, inviable para un juego). Cada entrada se resuelve contra
 * `installPath` y se rechaza si se sale de ahí (zip-slip) o es un enlace
 * simbólico. Se extrae a una carpeta temporal hermana y se hace un `rename`
 * atómico al final: una extracción interrumpida nunca deja un `installPath`
 * a medias que parezca completo.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as yauzl from 'yauzl';
import { err, ok, type Result } from '@ycore/result';
import { appError, fromUnknown, type AppError } from '@ycore/result/app-error';

const SYMLINK_UNIX_MODE_MASK = 0o170000;
const SYMLINK_UNIX_MODE = 0o120000;

/**
 * Reconoce tanto nuestros propios rechazos (`resolveEntryPath`,
 * `isSymlinkEntry`) como los que `yauzl` ya emite por su cuenta al parsear
 * una entrada con `..` o una ruta absoluta (antes de que nuestro código vea
 * la entrada) — ambos son la misma clase de error: una entrada de ZIP que
 * intenta escribir fuera de `installPath`.
 */
function isPathTraversalError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error.message.includes('zip-slip') ||
      error.message.includes('invalid relative path') ||
      error.message.includes('absolute path'))
  );
}

/**
 * Resuelve una entrada del ZIP contra `installPath`, rechazando cualquiera
 * que se salga de ese directorio (rutas con `..`, rutas absolutas).
 *
 * @returns La ruta absoluta segura, o `AppError` `download.zip-slip`.
 */
function resolveEntryPath(installPath: string, entryFileName: string): Result<string, AppError> {
  const target = resolve(installPath, entryFileName);
  const rel = relative(installPath, target);
  if (rel.startsWith('..') || resolve(rel) === rel) {
    return err(appError('download.zip-slip', { context: { entryFileName } }));
  }
  return ok(target);
}

/** Un `Entry` de yauzl con permisos Unix de enlace simbólico en `externalFileAttributes`. */
function isSymlinkEntry(entry: yauzl.Entry): boolean {
  const unixMode = entry.externalFileAttributes >>> 16;
  return (unixMode & SYMLINK_UNIX_MODE_MASK) === SYMLINK_UNIX_MODE;
}

async function extractEntry(zipFile: yauzl.ZipFile, entry: yauzl.Entry, targetPath: string): Promise<void> {
  if (entry.fileName.endsWith('/')) {
    await mkdir(targetPath, { recursive: true });
    return;
  }
  await mkdir(dirname(targetPath), { recursive: true });
  const readStream = await zipFile.openReadStreamPromise(entry);
  await pipeline(readStream, createWriteStream(targetPath));
}

/**
 * Extrae `zipPath` a `installPath`.
 *
 * @param zipPath - El ZIP ya verificado (ver `verifier.ts` — nunca se llama
 *   a esto sin verificar primero).
 * @param installPath - Directorio final de instalación.
 * @returns `ok(undefined)` si se extrajo todo correctamente, o `AppError`
 *   `download.zip-slip` (entrada maliciosa) / `io.failed` (fallo de disco o
 *   ZIP corrupto).
 */
export async function extractZip(zipPath: string, installPath: string): Promise<Result<void, AppError>> {
  const stagingPath = `${installPath}.staging`;

  try {
    await rm(stagingPath, { recursive: true, force: true });
    const zipFile = await yauzl.openPromise(zipPath, { lazyEntries: true });

    await new Promise<void>((resolvePromise, rejectPromise) => {
      zipFile.on('error', rejectPromise);
      zipFile.on('end', resolvePromise);
      zipFile.on('entry', (entry: yauzl.Entry) => {
        void handleEntry(zipFile, entry, stagingPath).then(
          () => zipFile.readEntry(),
          (error: Error) => rejectPromise(error),
        );
      });
      zipFile.readEntry();
    });

    await rm(installPath, { recursive: true, force: true });
    await rename(stagingPath, installPath);
  } catch (error) {
    await rm(stagingPath, { recursive: true, force: true }).catch(() => {});
    if (isPathTraversalError(error)) {
      return err(appError('download.zip-slip', { detail: error.message }));
    }
    return err({ ...fromUnknown(error), code: 'io.failed' });
  }

  return ok(undefined);
}

async function handleEntry(zipFile: yauzl.ZipFile, entry: yauzl.Entry, stagingPath: string): Promise<void> {
  if (isSymlinkEntry(entry)) {
    throw new Error(`zip-slip: enlace simbólico rechazado (${entry.fileName})`);
  }

  const resolved = resolveEntryPath(stagingPath, entry.fileName);
  if (resolved.ok === false) throw new Error(`zip-slip: ${entry.fileName}`);

  await extractEntry(zipFile, entry, resolved.value);
}
