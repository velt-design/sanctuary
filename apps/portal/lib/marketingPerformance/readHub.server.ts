import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validPeriod } from './contract';
import { hubSchema } from './hub';
import type { HubReadResult } from './initialHub';
import { readPreviewSnapshot } from './readSnapshot';
import { SnapshotCoverageError } from './snapshotData';

export const hubReadFailure = (): HubReadResult => ({ ok: false, status: 503, error: 'The hub could not be loaded. Please retry.' });

// Both callers establish current staff/developer authority first. The RPC repeats
// that authority check. There is deliberately no response or client cache here.
export async function readHub(supabase: Pick<SupabaseClient, 'rpc'>, start: string, end: string): Promise<HubReadResult> {
  if (!validPeriod(start, end)) return { ok: false, status: 400, error: 'Choose up to 366 days ending today or earlier.' };
  try {
    const snapshot = await readPreviewSnapshot(start, end);
    if (snapshot) return { ok: true, report: snapshot };
    const { data, error } = await supabase.rpc('marketing_sales_hub_read', { p_start: start, p_end: end });
    if (error) return { ok: false,
      status: error.code === '42501' ? 403 : error.code === '54000' ? 422 : 503,
      error: error.code === '42501' ? 'Developer access is required.'
        : error.code === '54000' ? 'Reporting limit reached. Narrow the dates; contact your administrator if the portfolio limit persists.'
          : 'The hub read is unavailable in this environment. Retry or contact your administrator.' };
    const report = hubSchema.safeParse(data);
    if (!report.success || report.data.start !== start || report.data.end !== end)
      return { ok: false, status: 503, error: 'The evidence could not be verified. No partial totals are shown.' };
    return { ok: true, report: report.data };
  } catch (error) {
    if (error instanceof SnapshotCoverageError) return { ok: false, status: 422, error: error.message };
    return hubReadFailure();
  }
}
