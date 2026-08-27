/**
 * `UpdateService` — orquesta el ciclo completo de actualización (ADR-0003, ADR-0005).
 *
 * Sirve como el único lugar que junta `checkForUpdate` (consulta silenciosa),
 * la descarga del instalador y del manifest, la verificación de la cadena de
 * confianza completa (Ed25519 + SHA-512), y el lanzamiento del instalador.
 * El estado se guarda solo en memoria — a diferencia de `DownloadService`
 * (ADR-0004), una actualización de la app no necesita sobrevivir a un
 * `kill -9`: si el proceso muere a mitad, el siguiente arranque vuelve a
 * `checkNow()` desde cero, que es barato y ya está diseñado para eso.
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { checkForUpdate, signCheckRequest, verifyManifestSignature, verifyArtifactSha512 } from '@ycore/updater-client';
import { ManifestSchema } from '@ycore/update-contract';
import { createLogger } from '@ycore/logger';
import { downloadToFile, downloadJson } from './download.js';
import { spawnSilentInstaller } from '../../platform/installer-launcher.js';

const log = createLogger('main:features:updates');

/** El estado del ciclo, tal como lo consume `handlers.ts` para traducirlo al contrato IPC. */
export type UpdateStatus =
  | { readonly phase: 'up-to-date' }
  | { readonly phase: 'available'; readonly version: string; readonly mandatory: boolean; readonly notes: { es: string; en: string } }
  | { readonly phase: 'downloading'; readonly version: string; readonly bytesDownloaded: number; readonly bytesTotal: number | null }
  | { readonly phase: 'ready-to-install'; readonly version: string; readonly mandatory: boolean }
  | { readonly phase: 'failed'; readonly reason: 'download-failed' | 'verification-failed' };

/** Todo lo que `UpdateService` necesita para hablar con el Worker y verificar la cadena de confianza. */
export interface UpdateServiceConfig {
  readonly workerBaseUrl: string;
  readonly clientSecret: string;
  readonly manifestPublicKeysBase64: readonly string[];
  readonly currentVersion: string;
  readonly channel: 'stable' | 'beta';
  readonly clientId: string;
}

export class UpdateService {
  private status: UpdateStatus = { phase: 'up-to-date' };
  private readyInstallerPath: string | null = null;

  constructor(private readonly config: UpdateServiceConfig) {}

  /** El estado actual, para que `handlers.ts` lo sirva vía `updates.getStatus` (polling). */
  getStatus(): UpdateStatus {
    return this.status;
  }

  /**
   * Consulta el Worker y, si hay una actualización disponible, dispara la
   * descarga y verificación en segundo plano (no espera a que termine).
   * Cualquier fallo de red/timeout/validación ya lo trata `checkForUpdate`
   * como `up-to-date` en silencio (ADR-0003) — este método nunca lanza.
   */
  async checkNow(): Promise<void> {
    const signature = await signCheckRequest(this.config.clientSecret, this.config.clientId, this.config.currentVersion, this.config.channel);
    const response = await checkForUpdate(this.config.workerBaseUrl, {
      version: this.config.currentVersion,
      channel: this.config.channel,
      platform: 'win32',
      arch: 'x64',
      clientId: this.config.clientId,
      signature,
    });

    if (response.status !== 'update-available') {
      this.status = { phase: 'up-to-date' };
      return;
    }

    this.status = { phase: 'available', version: response.version, mandatory: response.mandatory, notes: response.notes };
    void this.downloadAndVerify(response);
  }

  /**
   * Lanza el instalador ya verificado y cierra la app. Sin efecto si todavía
   * no hay ninguna actualización en fase `ready-to-install`.
   */
  installNow(onBeforeQuit: () => void): void {
    if (this.readyInstallerPath === null) return;

    const spawned = spawnSilentInstaller(this.readyInstallerPath);
    if (spawned.ok === false) {
      log.warn('no se pudo lanzar el instalador', { detail: spawned.error.detail });
      return;
    }
    onBeforeQuit();
  }

  private async downloadAndVerify(response: Extract<Awaited<ReturnType<typeof checkForUpdate>>, { status: 'update-available' }>): Promise<void> {
    this.status = {
      phase: 'downloading',
      version: response.version,
      bytesDownloaded: 0,
      bytesTotal: response.artifact.size,
    };

    const installerPath = join(tmpdir(), `y-core-update-${response.version}.exe`);

    const manifestJson = await downloadJson(response.artifact.manifestUrl);
    if (manifestJson.ok === false) return this.failDownload();

    const manifestParsed = ManifestSchema.safeParse(manifestJson.value);
    if (!manifestParsed.success) return this.failVerification();

    const signatureValid = await verifyManifestSignature(manifestParsed.data, this.config.manifestPublicKeysBase64);
    if (signatureValid.ok === false) return this.failVerification();

    const downloaded = await downloadToFile(response.artifact.url, installerPath);
    if (downloaded.ok === false) return this.failDownload();

    const shaValid = await verifyArtifactSha512(installerPath, manifestParsed.data.sha512);
    if (shaValid.ok === false) {
      await rm(installerPath, { force: true });
      return this.failVerification();
    }

    this.readyInstallerPath = installerPath;
    this.status = { phase: 'ready-to-install', version: response.version, mandatory: response.mandatory };
  }

  private failDownload(): void {
    log.warn('fallo al descargar la actualización');
    this.status = { phase: 'failed', reason: 'download-failed' };
  }

  private failVerification(): void {
    log.warn('la actualización descargada no superó la verificación de firma/integridad');
    this.status = { phase: 'failed', reason: 'verification-failed' };
  }
}
