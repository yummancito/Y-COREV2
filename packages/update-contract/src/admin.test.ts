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

describe('AdminReleaseSchema', () => {
  it('acepta un payload válido sin blockmap', () => {
    const result = AdminReleaseSchema.safeParse({
      version: '5.1.0',
      channel: 'stable',
      rollout: 10,
      r2Key: 'releases/5.1.0/Setup.exe',
      blockmapKey: null,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un rollout fuera de 0-100', () => {
    const result = AdminReleaseSchema.safeParse({
      version: '5.1.0',
      channel: 'stable',
      rollout: 150,
      r2Key: 'releases/5.1.0/Setup.exe',
      blockmapKey: null,
    });
    expect(result.success).toBe(false);
  });
});
