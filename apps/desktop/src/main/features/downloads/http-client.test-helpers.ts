/**
 * Servidor HTTP real y mínimo para testear `http-client.ts` contra
 * comportamientos que un mock no reproduciría de forma creíble: cabeceras
 * `Range`/`If-Range` reales, un servidor que "miente" y responde `200` en
 * vez de `206`, o que cambia el `ETag` a mitad de la reanudación.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type TestHandler = (req: IncomingMessage, res: ServerResponse) => void;

export interface TestServer {
  readonly url: string;
  close(): Promise<void>;
}

/** Levanta un servidor HTTP real en un puerto libre de localhost, con el handler dado. */
export async function startTestServer(handler: TestHandler): Promise<TestServer> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/file`,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

/** Lee un `ReadableStream<Uint8Array>` completo a un `Buffer`, para aserciones de contenido. */
export async function readAll(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
