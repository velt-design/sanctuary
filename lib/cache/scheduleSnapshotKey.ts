import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

function hostKey(): string {
  return supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
}

export function scheduleSnapshotSWRKey(): readonly ['schedule_snapshot', string] {
  return ['schedule_snapshot', hostKey()] as const;
}

