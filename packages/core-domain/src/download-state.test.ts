import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@ycore/result';
import { ALLOWED_TRANSITIONS, transition, type DownloadState, type DownloadStatus } from './download-state.js';

const ALL_STATUSES: readonly DownloadStatus[] = [
  'queued',
  'downloading',
  'paused',
  'verifying',
  'extracting',
  'installing',
  'done',
  'failed',
];

/** Construye un `DownloadState` mínimo válido para el `status` dado, con id fijo. */
function stateOf(status: DownloadStatus): DownloadState {
  switch (status) {
    case 'queued':
      return { id: 'd1', status: 'queued' };
    case 'downloading':
      return { id: 'd1', status: 'downloading', bytesDownloaded: 0, bytesTotal: null };
    case 'paused':
      return { id: 'd1', status: 'paused', bytesDownloaded: 0, bytesTotal: null };
    case 'verifying':
      return { id: 'd1', status: 'verifying' };
    case 'extracting':
      return { id: 'd1', status: 'extracting' };
    case 'installing':
      return { id: 'd1', status: 'installing' };
    case 'done':
      return { id: 'd1', status: 'done' };
    case 'failed':
      return { id: 'd1', status: 'failed', error: { code: 'unknown', retriable: false } };
  }
}

describe('transition — tabla exhaustiva estado x estado', () => {
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const isAllowed = ALLOWED_TRANSITIONS[from].has(to);

      it(`${from} -> ${to} es ${isAllowed ? 'legal' : 'ilegal'}`, () => {
        const result = transition(stateOf(from), stateOf(to));

        if (isAllowed) {
          expect(isOk(result)).toBe(true);
          if (isOk(result)) expect(result.value.status).toBe(to);
        } else {
          expect(isErr(result)).toBe(true);
          if (isErr(result)) expect(result.error.code).toBe('download.invalid-transition');
        }
      });
    }
  }
});

describe('transition — casos con datos reales', () => {
  it('downloading -> verifying conserva el id y descarta bytesDownloaded', () => {
    const from: DownloadState = { id: 'abc', status: 'downloading', bytesDownloaded: 500, bytesTotal: 1000 };
    const to: DownloadState = { id: 'abc', status: 'verifying' };

    const result = transition(from, to);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual({ id: 'abc', status: 'verifying' });
  });

  it('installing -> failed conserva el AppError', () => {
    const from: DownloadState = { id: 'abc', status: 'installing' };
    const to: DownloadState = {
      id: 'abc',
      status: 'failed',
      error: { code: 'io.failed', retriable: true, detail: 'disco lleno' },
    };

    const result = transition(from, to);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual(to);
  });

  it('done es terminal: no admite ninguna transición', () => {
    expect(ALLOWED_TRANSITIONS.done.size).toBe(0);
  });

  it('failed solo admite volver a queued (reintento explícito)', () => {
    expect([...ALLOWED_TRANSITIONS.failed]).toEqual(['queued']);
  });
});
