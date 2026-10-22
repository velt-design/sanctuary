import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';

/** Fresh session proof only. project_files_read must still prove current staff/project access. */
export async function projectFileOpenIdentity(): Promise<SupabaseClient | null> {
  try {
    const supabase = await getSupabaseServerAuth();
    const { data, error } = await supabase.auth.getUser();
    return !error && data.user ? supabase : null;
  } catch {
    return null;
  }
}
