import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./commands/release.js', () => ({ runRelease: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./commands/maintenance.js', () => ({ runMaintenance: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./commands/yank.js', () => ({ runYank: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./commands/rollout.js', () => ({ runRollout: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./commands/block.js', () => ({ runBlock: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./commands/stats.js', () => ({ runStats: vi.fn().mockResolvedValue(undefined) }));

describe('ycore main', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  it('despacha al comando stats con sus argumentos', async () => {
    const { runStats } = await import('./commands/stats.js');
    process.argv = ['node', 'ycore', 'stats', '--days', '30'];

    await import('./main.js');
    await new Promise((resolve) => setImmediate(resolve));

    expect(runStats).toHaveBeenCalledWith(['--days', '30']);
  });

  it('un comando desconocido imprime uso y marca exit code 1', async () => {
    process.argv = ['node', 'ycore', 'no-existe'];

    await import('./main.js');
    await new Promise((resolve) => setImmediate(resolve));

    expect(console.error).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('si el comando lanza, imprime FALLO y marca exit code 1', async () => {
    const { runYank } = await import('./commands/yank.js');
    vi.mocked(runYank).mockRejectedValueOnce(new Error('Falta --version <valor>.'));
    process.argv = ['node', 'ycore', 'yank', '--actor', 'y'];

    await import('./main.js');
    await new Promise((resolve) => setImmediate(resolve));

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('FALLO: Falta --version'));
    expect(process.exitCode).toBe(1);
  });
});
