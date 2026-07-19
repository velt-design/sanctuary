import 'server-only';

import type { User } from '@supabase/supabase-js';
import { cache } from 'react';
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

// React cache is scoped to the current server render. It prevents nested layouts
// and pages from repeating the same auth and portal-role lookup without creating
// a process-wide cache that could cross users or requests.
const getRequestPortalAccess = cache(async (): Promise<{
  accessState: PortalAccessState;
  authenticatedUser: User | null;
}> => {
  const supabase = await getSupabaseServerAuth();
  const lookup = supabase as unknown as PortalAccessLookup;
  let authenticatedUser: User | null = null;
  const trackedLookup: PortalAccessLookup = {
    auth: {
      getUser: async () => {
        const result = await supabase.auth.getUser();
        authenticatedUser = result.data?.user ?? null;
        return result;
      },
    },
    from: lookup.from.bind(lookup),
  };
  const accessState = await resolvePortalAccessState(trackedLookup);
  return { accessState, authenticatedUser };
});

export async function getPortalAccessState(): Promise<PortalAccessState> {
  return (await getRequestPortalAccess()).accessState;
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const { accessState, authenticatedUser } = await getRequestPortalAccess();
  if (accessState.kind !== 'authenticated' || !authenticatedUser) return null;
  return { user: authenticatedUser, role: accessState.session.role };
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

async function requirePortalSessionPageAccess(callbackUrl: string): Promise<PortalSession> {
  const { accessState, authenticatedUser } = await getRequestPortalAccess();
  if (accessState.kind !== 'authenticated') {
    redirectForAccessState(accessState, callbackUrl);
  }
  if (!authenticatedUser) {
    redirect(buildLoginHref(callbackUrl));
  }
  return { user: authenticatedUser, role: accessState.session.role };
}

export async function requireStaffPageAccess(callbackUrl: string): Promise<PortalSession> {
  return requirePortalSessionPageAccess(callbackUrl);
}

export async function requireAdminPageAccess(callbackUrl: string, fallbackHref = '/staff/calculator'): Promise<PortalSession> {
  const session = await requirePortalSessionPageAccess(callbackUrl);
  if (session.role !== 'admin') redirect(fallbackHref);
  return session;
}
