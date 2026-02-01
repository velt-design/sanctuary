import type { Contact } from '@/lib/types/contact';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

function supabaseHostKey(): string {
  const host = supabaseHostFromUrl(supabaseRuntimeUrl());
  return host || 'unknown';
}

export function contactsSWRKey(): readonly ['contacts', string] {
  return ['contacts', supabaseHostKey()] as const;
}
