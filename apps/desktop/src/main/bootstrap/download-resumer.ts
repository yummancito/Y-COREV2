/**
 * `resumeInterruptedDownloads` — retoma en el bootstrap las descargas que quedaron a mitad.
 *
 * Sirve para cumplir el criterio de HECHO de Fase 4 (ADR-0004): si Y-CORE se
 * cerró de golpe (`kill -9`, crash, cierre forzado de Windows) con una
 * descarga en curso, la fila queda en `downloading` en la DB sin que nadie
 * la retome — nadie llamó a `pause()`. Al arrancar, se buscan esas filas
 * huérfanas y se relanza su descarga desde el offset ya persistido.
 *
 * @param db - Conexión de Drizzle ya migrada.
 */

import { DownloadRepository, DownloadService } from '../features/downloads/index.js';
import type { YCoreDatabase } from '../db/index.js';

export function resumeInterruptedDownloads(db: YCoreDatabase): void {
  const service = new DownloadService(new DownloadRepository(db));
  service.resumeInterrupted();
}
