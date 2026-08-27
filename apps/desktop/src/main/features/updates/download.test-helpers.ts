/**
 * Servidor HTTP real y mínimo para testear `download.ts` — mismo patrón que
 * `main/features/downloads/http-client.test-helpers.ts`.
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
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
