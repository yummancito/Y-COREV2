/**
 * Schemas de `GET /v1/check` — el contrato compartido entre `services/update-worker`
 * y `packages/updater-client` (ADR-0005, punto 3.b).
 *
 * Sirve para que las dos mitades compiladas por separado (el Worker y la app)
 * nunca puedan divergir sobre la forma de la respuesta: el Worker valida su
 * output contra `CheckResponseSchema` en test, y el cliente valida la
 * respuesta real contra el mismo objeto antes de confiar en ella (ADR-0003:
 * cualquier respuesta que no valide se trata como `up-to-date` en silencio).
 */

import { z } from 'zod';

export const CheckRequestSchema = z
  .object({
    version: z.string().describe('Versión instalada actualmente, semver.'),
    channel: z.enum(['stable', 'beta']).describe('Canal de actualizaciones suscrito.'),
    platform: z.literal('win32').describe('Plataforma del cliente. Solo Windows.'),
    arch: z.literal('x64').describe('Arquitectura del cliente.'),
    clientId: z.uuid().describe('UUID v4 local y estable, para el rollout determinista. No es PII.'),
  })
  .describe('Query params de GET /v1/check.');

const NotesSchema = z
  .object({
    es: z.string().describe('Notas de la versión en español.'),
    en: z.string().describe('Notas de la versión en inglés.'),
  })
  .describe('Notas de una release, por idioma.');

const ArtifactSchema = z
  .object({
    kind: z.literal('nsis').describe('Formato del instalador.'),
    size: z.number().int().positive().describe('Tamaño del artefacto completo, en bytes.'),
    sha512: z.string().describe('Hash SHA-512 del artefacto completo, en hexadecimal.'),
    url: z.string().describe('URL firmada de /v1/download para el artefacto completo. TTL 15 min.'),
    urlExpiresAt: z.iso.datetime().describe('Cuándo deja de ser válida la URL firmada.'),
    manifestUrl: z
      .string()
      .describe(
        'URL firmada de /v1/download para el manifest.json firmado con Ed25519 por el pipeline de CI. ' +
          'El cliente lo descarga y verifica la firma antes de confiar en sha512/size (ADR-0003).',
      ),
  })
  .describe('El instalador completo de la versión.');

const DeltaSchema = z
  .object({
    fromVersion: z.string().describe('Versión instalada desde la que aplica este diferencial.'),
    blockmapUrl: z.string().describe('URL firmada de /v1/download para el .blockmap.'),
    estimatedSize: z.number().int().nonnegative().describe('Tamaño estimado de la descarga diferencial, en bytes.'),
  })
  .describe('Datos para la descarga diferencial vía blockmap, si aplica.');

const UpToDateSchema = z
  .object({
    status: z.literal('up-to-date'),
    checkAgainInSeconds: z.number().int().positive().describe('Segundos hasta la próxima comprobación.'),
  })
  .describe('El cliente ya tiene la versión más reciente para su canal (o el servidor está en modo mantenimiento).');

const UpdateAvailableSchema = z
  .object({
    status: z.literal('update-available'),
    version: z.string().describe('Versión nueva disponible.'),
    channel: z.enum(['stable', 'beta']),
    mandatory: z.boolean().describe('Si la actualización es obligatoria antes de seguir usando la app.'),
    notes: NotesSchema,
    artifact: ArtifactSchema,
    delta: DeltaSchema.nullable().describe('null si no hay diferencial disponible desde la versión del cliente.'),
    checkAgainInSeconds: z.number().int().positive(),
  })
  .describe('Hay una versión nueva para este cliente.');

const BlockedSchema = z
  .object({
    status: z.literal('blocked'),
    reason: z.string().describe('Código corto del motivo del bloqueo (p. ej. "critical-bug").'),
    message: NotesSchema.describe('Mensaje explicando el bloqueo, por idioma.'),
    forceUpdateTo: z.string().describe('Versión a la que el cliente debe actualizar para dejar de estar bloqueado.'),
  })
  .describe('La versión instalada del cliente es tóxica: se le exige actualizar antes de seguir.');

/** Unión discriminada por `status` — las tres únicas respuestas posibles de /v1/check (ADR-0003). */
export const CheckResponseSchema = z
  .discriminatedUnion('status', [UpToDateSchema, UpdateAvailableSchema, BlockedSchema])
  .describe('Respuesta de GET /v1/check.');

export type CheckRequest = z.infer<typeof CheckRequestSchema>;
export type CheckResponse = z.infer<typeof CheckResponseSchema>;
