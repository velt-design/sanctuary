import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

function supabaseHostKey(): string {
  return supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
}

export function siteVisitsSnapshotSWRKey(): readonly ['site_visits_snapshot_v2', string] {
  // v2: invalidate earlier snapshots that included old sales lanes / shapes.
  return ['site_visits_snapshot_v2', supabaseHostKey()] as const;
}
