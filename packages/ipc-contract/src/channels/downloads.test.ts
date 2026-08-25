import { describe, expect, it } from 'vitest';
import { downloadsChannels } from './downloads.js';

const validHash = 'a'.repeat(64);

describe('downloadsChannels.enqueue', () => {
  it('acepta un payload válido completo', () => {
    const result = downloadsChannels['downloads.enqueue'].input.safeParse({
      appId: 730,
      sourceUrl: 'https://example.invalid/cs2.zip',
      installPath: 'C:\\Steam\\steamapps\\common\\cs2',
      expectedSha256: validHash,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un expectedSha256 que no mide 64 caracteres', () => {
    const result = downloadsChannels['downloads.enqueue'].input.safeParse({
      appId: 730,
      sourceUrl: 'https://example.invalid/cs2.zip',
      installPath: 'C:\\Steam',
      expectedSha256: 'demasiado-corto',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza una sourceUrl que no es una URL válida', () => {
    const result = downloadsChannels['downloads.enqueue'].input.safeParse({
      appId: 730,
      sourceUrl: 'no-es-una-url',
      installPath: 'C:\\Steam',
      expectedSha256: validHash,
    });
    expect(result.success).toBe(false);
  });

  it('output exige un id de descarga', () => {
    expect(downloadsChannels['downloads.enqueue'].output.safeParse({ id: 'd1' }).success).toBe(true);
    expect(downloadsChannels['downloads.enqueue'].output.safeParse({}).success).toBe(false);
  });
});

describe('downloadsChannels.list', () => {
  it('output acepta cada variante de DownloadState', () => {
    const states = [
      { id: 'a', status: 'queued' },
      { id: 'b', status: 'downloading', bytesDownloaded: 10, bytesTotal: 100 },
      { id: 'c', status: 'paused', bytesDownloaded: 10, bytesTotal: null },
      { id: 'd', status: 'verifying' },
      { id: 'e', status: 'extracting' },
      { id: 'f', status: 'installing' },
      { id: 'g', status: 'done' },
      { id: 'h', status: 'failed', error: { code: 'net.unreachable', retriable: true } },
    ];

    for (const state of states) {
      const result = downloadsChannels['downloads.list'].output.safeParse({
        downloads: [{ state, appId: 730 }],
      });
      expect(result.success).toBe(true);
    }
  });

  it('rechaza un status desconocido', () => {
    const result = downloadsChannels['downloads.list'].output.safeParse({
      downloads: [{ state: { id: 'x', status: 'unknown-status' }, appId: 730 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('downloadsChannels.pause y cancel', () => {
  it('input exige un id', () => {
    expect(downloadsChannels['downloads.pause'].input.safeParse({ id: 'd1' }).success).toBe(true);
    expect(downloadsChannels['downloads.pause'].input.safeParse({}).success).toBe(false);
    expect(downloadsChannels['downloads.cancel'].input.safeParse({ id: 'd1' }).success).toBe(true);
  });
});
