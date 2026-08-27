/**
 * Schemas de los endpoints `POST /v1/admin/*` — la CLI `ycore` (ADR-0005, punto 5)
 * los usa para publicar releases, cambiar el rollout y activar/desactivar el
 * modo mantenimiento. Autenticados por bearer token, no por estos schemas.
 */

import { z } from 'zod';

export const AdminMaintenanceSchema = z
  .object({
    enabled: z.boolean().describe('true para activar el modo mantenimiento silencioso, false para desactivarlo.'),
    note: z.string().describe('Motivo, para el registro de auditoría (maintenance_log).'),
    actor: z.string().describe('Quién hizo el cambio (usuario o proceso de CI).'),
  })
  .describe('Body de POST /v1/admin/maintenance.');

export const AdminReleaseSchema = z
  .object({
    version: z.string().describe('Versión de la release a publicar, semver.'),
    channel: z.enum(['stable', 'beta']).describe('Canal donde se publica.'),
    rollout: z.number().int().min(0).max(100).describe('Porcentaje inicial de rollout (0-100).'),
    r2Key: z.string().describe('Clave del instalador completo dentro del bucket R2.'),
    blockmapKey: z.string().nullable().describe('Clave del .blockmap en R2, o null si no hay diferencial.'),
    size: z.number().int().positive().describe('Tamaño del instalador completo, en bytes.'),
    sha512: z.string().describe('Hash SHA-512 del instalador completo, en hexadecimal.'),
    blockmapSha512: z.string().nullable().describe('Hash SHA-512 del .blockmap, o null si no hay diferencial.'),
    estimatedDeltaSize: z.number().int().nonnegative().nullable().describe('Tamaño estimado de la descarga diferencial, o null.'),
    notes: z
      .object({ es: z.string().describe('Notas en español.'), en: z.string().describe('Notas en inglés.') })
      .describe('Notas de la release, por idioma.'),
    mandatory: z.boolean().describe('Si esta actualización es obligatoria.'),
  })
  .describe('Body de POST /v1/admin/release — el manifest ya fue subido a R2 firmado por CI.');

export const AdminYankSchema = z
  .object({
    version: z.string().describe('Versión a retirar: deja de ofrecerse en /v1/check, sin borrar el historial.'),
    actor: z.string().describe('Quién hizo el cambio (usuario o proceso de CI).'),
  })
  .describe('Body de POST /v1/admin/yank.');

export const AdminRolloutSchema = z
  .object({
    channel: z.enum(['stable', 'beta']).describe('Canal cuyo rollout se cambia.'),
    rollout: z.number().int().min(0).max(100).describe('Nuevo porcentaje de rollout (0-100) para el latest del canal.'),
    actor: z.string().describe('Quién hizo el cambio (usuario o proceso de CI).'),
  })
  .describe('Body de POST /v1/admin/rollout — no publica una release nueva, solo ajusta el porcentaje.');

export const AdminBlockSchema = z
  .object({
    version: z.string().describe('Versión a bloquear (kill-switch): el cliente recibe status "blocked".'),
    reason: z.string().describe('Motivo del bloqueo, se muestra en la auditoría.'),
    forceTo: z.string().describe('Versión a la que se fuerza la actualización del cliente bloqueado.'),
    actor: z.string().describe('Quién hizo el cambio (usuario o proceso de CI).'),
  })
  .describe('Body de POST /v1/admin/block.');

export type AdminMaintenanceInput = z.infer<typeof AdminMaintenanceSchema>;
export type AdminReleaseInput = z.infer<typeof AdminReleaseSchema>;
export type AdminYankInput = z.infer<typeof AdminYankSchema>;
export type AdminRolloutInput = z.infer<typeof AdminRolloutSchema>;
export type AdminBlockInput = z.infer<typeof AdminBlockSchema>;
