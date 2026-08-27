import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { downloadToFile, downloadJson } from './download.js';
import { startTestServer, type TestServer } from './download.test-helpers.js';

describe('downloadToFile', () => {
  let server: TestServer | null = null;
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ycore-updates-test-'));
  });

  afterEach(async () => {
    await server?.close();
    server = null;
    rmSync(dir, { recursive: true, force: true });
  });

  it('escribe el contenido completo de la respuesta en destinationPath', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(200);
      res.end('contenido del instalador');
    });
    const destinationPath = join(dir, 'Setup.exe');

    const result = await downloadToFile(server.url, destinationPath);

    expect(result.ok).toBe(true);
    expect(readFileSync(destinationPath, 'utf8')).toBe('contenido del instalador');
  });

  it('devuelve net.unreachable si el status no es ok', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(500);
      res.end();
    });

    const result = await downloadToFile(server.url, join(dir, 'Setup.exe'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('net.unreachable');
  });

  it('devuelve net.unreachable si la conexión falla', async () => {
    const result = await downloadToFile('http://127.0.0.1:1', join(dir, 'Setup.exe'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('net.unreachable');
  });
});

describe('downloadJson', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('devuelve el JSON parseado', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ version: '5.1.0' }));
    });

    const result = await downloadJson(server.url);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ version: '5.1.0' });
  });

  it('devuelve net.unreachable si el status no es ok', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });

    const result = await downloadJson(server.url);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('net.unreachable');
  });

  it('devuelve unknown si el body no es JSON válido', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(200);
      res.end('esto no es json');
    });

    const result = await downloadJson(server.url);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown');
  });
});
