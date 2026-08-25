/**
 * Construye fixtures ZIP reales para testear `extractor.ts` contra archivos
 * ZIP de verdad.
 *
 * `buildZip` usa `yazl` (el hermano de escritura de `yauzl`) para el caso
 * normal. `buildMaliciousZip` arma los bytes del formato ZIP a mano (sin
 * compresión, "store"), porque `yazl` valida y rechaza cualquier
 * `metadataPath` con un segmento `..` — necesitamos precisamente esa entrada
 * inválida para probar que `extractZip` la rechaza.
 */

import { createWriteStream, writeFileSync } from 'node:fs';
import * as yazl from 'yazl';

/** Arma un ZIP en `outputPath` con las entradas `{ metadataPath: contenido }` dadas. */
export async function buildZip(outputPath: string, entries: Record<string, string>): Promise<void> {
  const zipFile = new yazl.ZipFile();
  for (const [metadataPath, content] of Object.entries(entries)) {
    zipFile.addBuffer(Buffer.from(content), metadataPath);
  }
  await writeZip(outputPath, zipFile);
}

/** Arma un ZIP con una única carpeta vacía declarada explícitamente (sin archivos). */
export async function buildZipWithEmptyDir(outputPath: string, directoryPath: string): Promise<void> {
  const zipFile = new yazl.ZipFile();
  zipFile.addEmptyDirectory(directoryPath);
  await writeZip(outputPath, zipFile);
}

function writeZip(outputPath: string, zipFile: yazl.ZipFile): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath);
    output.on('close', resolve);
    output.on('error', reject);
    zipFile.outputStream.pipe(output);
    zipFile.end();
  });
}

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

/** Arma, a mano, un ZIP de una sola entrada sin comprimir con el nombre de archivo exacto dado. */
export function buildMaliciousZip(outputPath: string, fileName: string, content: string): void {
  const nameBuffer = Buffer.from(fileName, 'utf8');
  const contentBuffer = Buffer.from(content, 'utf8');
  const crc = crc32(contentBuffer);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(contentBuffer.length, 18);
  localHeader.writeUInt32LE(contentBuffer.length, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const localEntry = Buffer.concat([localHeader, nameBuffer, contentBuffer]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(contentBuffer.length, 20);
  centralHeader.writeUInt32LE(contentBuffer.length, 24);
  centralHeader.writeUInt16LE(nameBuffer.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const centralEntry = Buffer.concat([centralHeader, nameBuffer]);

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(1, 8);
  endRecord.writeUInt16LE(1, 10);
  endRecord.writeUInt32LE(centralEntry.length, 12);
  endRecord.writeUInt32LE(localEntry.length, 16);
  endRecord.writeUInt16LE(0, 20);

  writeFileSync(outputPath, Buffer.concat([localEntry, centralEntry, endRecord]));
}
