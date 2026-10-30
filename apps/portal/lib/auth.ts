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
import { headers } from 'next/headers';
import { DOCUMENT_CALLBACK_HEADER, NAVIGATION_CALLBACK_HEADER, regionalDocumentCallback, regionalNavigationCallback } from './regionalDocumentAccess';
import { getDocumentRenderDiagnostics } from '@/lib/performance/documentRenderDiagnostics';
import { resolveStudioPortalAccessState, type StudioPortalAccessLookup, type PortalAccessMode } from './studioPortalAccess.server';

export type PortalSession = {
  user: User;
  role: PortalRole;
};

// React cache is scoped to the current server render. It prevents nested layouts
// and pages from repeating the same auth and portal-role lookup without creating
// a process-wide cache that could cross users or requests.
async function readPortalAccess(mode?: PortalAccessMode): Promise<{
  accessState: PortalAccessState;
  authenticatedUser: User | null;
}> {
  const diagnostics = await getDocumentRenderDiagnostics();
  const startedAt = performance.now();
  try {
    const supabase = await getSupabaseServerAuth();
    const lookup = supabase as unknown as PortalAccessLookup;
    let authenticatedUser: User | null = null;
    const trackedLookup: StudioPortalAccessLookup = {
      auth: {
        getSession: () => supabase.auth.getSession(),
        getUser: async (jwt) => {
          const readUser = () => jwt ? supabase.auth.getUser(jwt) : supabase.auth.getUser();
          const result = await (diagnostics ? diagnostics.measureTransport('rsc.identity', readUser) : readUser());
          authenticatedUser = result.data?.user ?? null;
          return result;
        },
      },
      from: lookup.from.bind(lookup),
    };
    const accessState = mode === 'studio-opening' ? await resolveStudioPortalAccessState(trackedLookup) : await resolvePortalAccessState(trackedLookup, diagnostics?.accessObserver('rsc'));
    diagnostics?.record('rsc.access', startedAt, accessState.kind);
    return { accessState, authenticatedUser };
  } catch (error) {
    diagnostics?.record('rsc.access', startedAt, 'error');
    throw error;
  }
}

const getRequestPortalAccess = cache(readPortalAccess);

export async function getPortalAccessState(): Promise<PortalAccessState> {
  return (await getRequestPortalAccess()).accessState;
}

/** Same request-owned fresh authority; Studio mode changes only its verified read path. */
export async function getPortalAccessContext(mode?: PortalAccessMode) {
  return mode ? getRequestPortalAccess(mode) : getRequestPortalAccess();
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const { accessState, authenticatedUser } = await getRequestPortalAccess();
  if (accessState.kind !== 'authenticated' || !authenticatedUser) return null;
  return { user: authenticatedUser, role: accessState.session.role };
}

/** Long-running reads revalidate the same resolver outside the render cache. */
export async function getFreshPortalSession(): Promise<PortalSession | null> {
  const { accessState, authenticatedUser } = await readPortalAccess();
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
  // Middleware overwrites this redirect-only context. It never supplies access.
  const requestHeaders = await headers();
  const context = regionalDocumentCallback(requestHeaders.get(DOCUMENT_CALLBACK_HEADER))
    ?? regionalNavigationCallback(requestHeaders.get(NAVIGATION_CALLBACK_HEADER));
  return requirePortalSessionPageAccess(context ?? callbackUrl);
}

export async function requireRegionalDocumentAccess(): Promise<void> {
  const requestHeaders = await headers();
  const callback = regionalDocumentCallback(requestHeaders.get(DOCUMENT_CALLBACK_HEADER))
    ?? regionalNavigationCallback(requestHeaders.get(NAVIGATION_CALLBACK_HEADER));
  if (callback) await requirePortalSessionPageAccess(callback);
}

export async function requireAdminPageAccess(callbackUrl: string, fallbackHref = '/staff/calculator'): Promise<PortalSession> {
  const session = await requirePortalSessionPageAccess(callbackUrl);
  if (session.role !== 'admin') redirect(fallbackHref);
  return session;
}
