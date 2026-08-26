import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { describe, expect, it } from 'vitest';
import { TokenBucket } from '@ycore/core-domain';
import { createThrottledPassThrough } from './service.js';

/**
 * Testea el throttling de ancho de banda contra un `Transform` puro (sin
 * `DownloadService`, sin servidor HTTP, sin DB): determinista y rápido.
 * Medir esto a través del ciclo completo de una descarga real requeriría
 * comparar tiempos de reloj bajo la carga variable de correr toda la suite
 * junta, lo que resultó frágil (ver aprendizaje.md).
 */
async function collectOutput(bucket: TokenBucket, content: Buffer): Promise<Buffer[]> {
  const chunks: Buffer[] = [];
  const transform = createThrottledPassThrough(bucket);
  transform.on('data', (chunk: Buffer) => chunks.push(chunk));

  await pipeline(Readable.from([content]), transform);
  return chunks;
}

describe('createThrottledPassThrough', () => {
  it('deja pasar todo el contenido intacto, sin límite configurado', async () => {
    const bucket = new TokenBucket();
    const content = Buffer.from('hola mundo, esto es una descarga de prueba');

    const chunks = await collectOutput(bucket, content);

    expect(Buffer.concat(chunks).toString()).toBe(content.toString());
  });

  it('con un límite bajo, un chunk que supera el cupo se trocea en varios push()', async () => {
    // Bucket con cupo inicial de solo 10 bytes: un chunk de 30 tiene que
    // salir dividido, esperando la recarga entre trozos (setTimeout real,
    // de milisegundos — no se mide el tiempo, solo el troceo).
    const bucket = new TokenBucket(10, Date.now());
    const content = Buffer.from('x'.repeat(30));

    const chunks = await collectOutput(bucket, content);

    expect(Buffer.concat(chunks).toString()).toBe(content.toString());
    expect(chunks.length).toBeGreaterThan(1);
    // El primer trozo nunca supera el cupo inicial del bucket.
    expect(chunks[0]?.length).toBeLessThanOrEqual(10);
  }, 10000);
});
