import 'server-only';

import type { User } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import type { PortalRole } from '@/lib/authTypes';

export type PortalSession = {
  user: User;
  role: PortalRole;
};

export async function getPortalSession(): Promise<PortalSession | null> {
  const supabase = getSupabaseServerAuth();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return null;

  const { data: portalUser, error: portalError } = await supabase
    .from('portal_users')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (portalError || !portalUser?.role) return null;

  const role = portalUser.role === 'admin' ? 'admin' : 'staff';
  return { user: userData.user, role };
}
