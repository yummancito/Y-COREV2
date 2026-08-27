/**
 * `ReleaseRecord` — una fila de la tabla D1 `releases` (roadmap C.3), ya
 * mapeada a tipos de dominio (no la fila cruda de SQLite).
 *
 * Puro: sin I/O. `data/releases-d1.ts` es quien lee/escribe esto de verdad.
 */

export interface ReleaseRecord {
  readonly version: string;
  readonly channel: string;
  readonly r2Key: string;
  readonly blockmapKey: string | null;
  readonly manifestKey: string;
  readonly size: number;
  readonly sha512: string;
  readonly blockmapSha512: string | null;
  /** Tamaño estimado de la descarga diferencial, en bytes. `null` si no hay blockmap. */
  readonly estimatedDeltaSize: number | null;
  readonly notes: { readonly es: string; readonly en: string };
  readonly mandatory: boolean;
  readonly publishedAt: string;
  readonly yanked: boolean;
}
