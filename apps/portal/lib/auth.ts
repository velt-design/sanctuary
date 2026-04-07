import 'server-only';

import type { User } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import type { PortalRole } from '@/lib/authTypes';
import {
  buildAccessStatusHref,
  buildLoginHref,
  resolvePortalAccessState,
  toAccessStatusQueryState,
  type PortalAccessLookup,
  type PortalAccessState,
} from '@/lib/portalAccess';
import { redirect } from 'next/navigation';

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

function redirectForAccessState(accessState: PortalAccessState, callbackUrl: string): never {
  if (accessState.kind === 'unauthenticated') {
    redirect(buildLoginHref(callbackUrl));
  }

  if (accessState.kind === 'no_access' || accessState.kind === 'lookup_failed') {
    redirect(
      buildAccessStatusHref({
        state: toAccessStatusQueryState(accessState.kind),
        callbackUrl,
      }),
    );
  }

  throw new Error('Expected authenticated portal access state before redirect handling.');
}

export async function requirePortalSessionPageAccess(callbackUrl: string): Promise<PortalSession> {
  const accessState = await getPortalAccessState();
  if (accessState.kind !== 'authenticated') {
    redirectForAccessState(accessState, callbackUrl);
  }

  const supabase = await getSupabaseServerAuth();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    redirect(buildLoginHref(callbackUrl));
  }

  return {
    user: userData.user,
    role: accessState.session.role,
  };
}

export async function requireStaffPageAccess(callbackUrl: string): Promise<PortalSession> {
  return requirePortalSessionPageAccess(callbackUrl);
}

export async function requireAdminPageAccess(callbackUrl: string, fallbackHref = '/staff/calculator'): Promise<PortalSession> {
  const session = await requirePortalSessionPageAccess(callbackUrl);
  if (session.role !== 'admin') redirect(fallbackHref);
  return session;
}
