import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getDashboardPipelineCounts } from './pipelineCounts';

const counts = { NEW: 12, CONTACTED: 8, SITE_VISIT: 4, QUOTING: 2, SENT: 3, DEPOSIT: 1, SCHEDULED: 2, COMPLETED: 3, PAID: 7 };
const data = { scope: 'open_enquiry_proposal_v1', counts };
describe('authenticated dashboard pipeline count adapter', () => {
  it('requests the uncapped versioned RPC and preserves later-stage history', async () => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    expect(await getDashboardPipelineCounts({ rpc } as unknown as SupabaseClient)).toEqual(counts);
    expect(rpc).toHaveBeenCalledWith('staff_dashboard_pipeline_counts_v1');
  });
  it.each([
    { data: null, error: { message: 'unavailable' } },
    { data: { ...data, scope: 'old_all_states' }, error: null },
    { data: { ...data, counts: { NEW: 1 } }, error: null },
    { data: { ...data, counts: { ...counts, PAID: -1 } }, error: null },
  ])('refuses unavailable, stale-scope or incomplete counts', async (response) => {
    await expect(getDashboardPipelineCounts({ rpc: vi.fn().mockResolvedValue(response) } as unknown as SupabaseClient)).rejects.toThrow();
  });
});
