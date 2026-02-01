import { unstable_cache } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabaseClient';
import type { QueueMode } from './types';

export async function getDashboardSnapshotCached(queueMode: QueueMode) {
  const cached = unstable_cache(
    async () => {
      const supabase = getSupabaseServer();
      const { data, error } = await supabase.rpc('dashboard_snapshot_v1', {
        queue_mode: queueMode,
        tz: 'Pacific/Auckland',
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Dashboard snapshot returned no data.');
      return data as unknown;
    },
    ['dashboard_snapshot_v1', queueMode],
    { revalidate: 10 },
  );

  return cached();
}
