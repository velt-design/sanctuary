import type { PortalRole } from '@/lib/authTypes';
import { getSupabaseBrowser } from '@/lib/supabase/browserClient';

export async function fetchPortalRole(userId: string): Promise<PortalRole | null> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.from('portal_users').select('role').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data?.role === 'admin') return 'admin';
  if (data?.role === 'staff') return 'staff';
  return null;
}
