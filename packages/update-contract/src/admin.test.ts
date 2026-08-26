import { describe, expect, it } from 'vitest';
import { AdminMaintenanceSchema, AdminReleaseSchema } from './admin.js';

describe('AdminMaintenanceSchema', () => {
  it('acepta un payload válido', () => {
    const result = AdminMaintenanceSchema.safeParse({ enabled: true, note: 'migrando R2', actor: 'yummancito' });
    expect(result.success).toBe(true);
  });

  it('rechaza si falta actor', () => {
    expect(AdminMaintenanceSchema.safeParse({ enabled: true, note: 'x' }).success).toBe(false);
  });
});

const validRelease = {
  version: '5.1.0',
  channel: 'stable',
  rollout: 10,
  r2Key: 'releases/5.1.0/Setup.exe',
  blockmapKey: null,
  size: 98123456,
  sha512: 'a'.repeat(128),
  blockmapSha512: null,
  estimatedDeltaSize: null,
  notes: { es: 'notas', en: 'notes' },
  mandatory: false,
};

describe('AdminReleaseSchema', () => {
  it('acepta un payload válido sin blockmap', () => {
    expect(AdminReleaseSchema.safeParse(validRelease).success).toBe(true);
  });

  it('acepta un payload válido con blockmap', () => {
    const withBlockmap = {
      ...validRelease,
      blockmapKey: 'releases/5.1.0/Setup.exe.blockmap',
      blockmapSha512: 'b'.repeat(128),
      estimatedDeltaSize: 14_200_000,
    };
    expect(AdminReleaseSchema.safeParse(withBlockmap).success).toBe(true);
  });

  it('rechaza un rollout fuera de 0-100', () => {
    expect(AdminReleaseSchema.safeParse({ ...validRelease, rollout: 150 }).success).toBe(false);
  });

  it('rechaza si falta size', () => {
    const withoutSize: Record<string, unknown> = { ...validRelease };
    delete withoutSize['size'];
    expect(AdminReleaseSchema.safeParse(withoutSize).success).toBe(false);
  });
});
