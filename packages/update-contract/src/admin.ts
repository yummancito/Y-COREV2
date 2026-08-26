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
  })
  .describe('Body de POST /v1/admin/release — el manifest ya fue subido a R2 firmado por CI.');

export type AdminMaintenanceInput = z.infer<typeof AdminMaintenanceSchema>;
export type AdminReleaseInput = z.infer<typeof AdminReleaseSchema>;
