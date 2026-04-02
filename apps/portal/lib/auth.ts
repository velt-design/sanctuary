import 'server-only';

import type { User } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import type { PortalRole } from '@/lib/authTypes';
import { resolvePortalAccessState, type PortalAccessLookup, type PortalAccessState } from '@/lib/portalAccess';

export type PortalSession = {
  user: User;
  role: PortalRole;
};

export async function getPortalAccessState(): Promise<PortalAccessState> {
  const supabase = await getSupabaseServerAuth();
  return resolvePortalAccessState(supabase as unknown as PortalAccessLookup);
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const accessState = await getPortalAccessState();
  if (accessState.kind !== 'authenticated') return null;

  const supabase = await getSupabaseServerAuth();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return null;

  return {
    user: userData.user,
    role: accessState.session.role,
  };
}
