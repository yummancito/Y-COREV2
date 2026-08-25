/**
 * `DownloadRecord` — una descarga completa: su `DownloadState` (core-domain) más los
 * metadatos fijos que ese estado no lleva (URL de origen, rutas, hash esperado).
 *
 * Sirve para separar lo que `@ycore/core-domain` puede validar con tipos
 * (qué campos tiene sentido que lleve cada estado) de lo que es solo dato de
 * persistencia (de dónde se descarga, a dónde se instala). `DownloadState`
 * no lleva `sourceUrl`/`expectedSha256`/etc. porque esos no cambian entre
 * transiciones — mezclarlos en la unión discriminada solo añadiría ruido.
 */

import type { DownloadState } from '@ycore/core-domain';

/** Metadatos de una descarga que no cambian con su estado. */
export interface DownloadMetadata {
  readonly appId: number;
  readonly sourceUrl: string;
  readonly destinationPath: string;
  readonly installPath: string;
  readonly expectedSha256: string;
  readonly etag: string | null;
  readonly lastModified: string | null;
  readonly segmentIndex: number;
  readonly segmentCount: number;
  readonly retryCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Una descarga completa: su estado (core-domain) más sus metadatos fijos. */
export interface DownloadRecord {
  readonly state: DownloadState;
  readonly metadata: DownloadMetadata;
}
