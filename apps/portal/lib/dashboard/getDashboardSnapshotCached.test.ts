import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: { rpc },
}));

describe('getDashboardSnapshotCached', () => {
  beforeEach(() => {
    vi.resetModules();
    rpc.mockReset();
  });

  it('loads the dashboard snapshot through the explicit service-role client', async () => {
    rpc.mockResolvedValueOnce({ data: { updatedAtIso: '2026-04-07T00:00:00.000Z' }, error: null });

    const { getDashboardSnapshotCached } = await import('./getDashboardSnapshotCached');
    await expect(getDashboardSnapshotCached('today')).resolves.toEqual({ updatedAtIso: '2026-04-07T00:00:00.000Z' });

    expect(rpc).toHaveBeenCalledWith('dashboard_snapshot_v1', {
      queue_mode: 'today',
      tz: 'Pacific/Auckland',
    });
  });

  it('throws when the RPC returns an error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'snapshot failed' } });

    const { getDashboardSnapshotCached } = await import('./getDashboardSnapshotCached');
    await expect(getDashboardSnapshotCached('next7')).rejects.toThrow('snapshot failed');
  });

  it('throws when the RPC returns no data', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });

    const { getDashboardSnapshotCached } = await import('./getDashboardSnapshotCached');
    await expect(getDashboardSnapshotCached('alldue')).rejects.toThrow('Dashboard snapshot returned no data.');
  });
});
