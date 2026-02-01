import type { Project } from '@/lib/types/project';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

function supabaseHostKey(): string {
  const host = supabaseHostFromUrl(supabaseRuntimeUrl());
  return host || 'unknown';
}

export function projectsSWRKey(): readonly ['projects', string] {
  return ['projects', supabaseHostKey()] as const;
}
