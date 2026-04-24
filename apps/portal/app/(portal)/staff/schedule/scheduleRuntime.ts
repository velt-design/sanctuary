import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

export function getScheduleSupabaseHost(): string {
  return supabaseHostFromUrl(supabaseRuntimeUrl());
}
