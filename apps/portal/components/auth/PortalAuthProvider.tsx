'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { setProjectIndexSession } from '@/lib/projects/projectIndexSession';
import { fetchPortalRole } from '@/lib/queries/auth';
import type { PortalRole } from '@/lib/authTypes';
import { type PortalAuthInitialState, type PortalAuthStatus, type PortalAuthUser, toPortalAuthUser } from '@/lib/portalAccess';
import {
  clearLocalFirstStoreOwner,
  discardAllLocalFirstState,
  getLocalFirstStoreOwner,
  getLocalFirstStoreSnapshot,
  summarizeLocalFirstStoreState,
} from '@/lib/localFirst/store';
import { stopLocalFirstRuntime } from '@/lib/localFirst/runtime';
import { clearLegacyUnscopedCalculatorSessionDrafts } from '@/lib/localFirst/sessionBoundary';

const ROLE_CACHE_KEY = 'sanctuary-portal:portal-role-cache:v1';

type BrowserSessionRead =
  | { status: 'available'; session: Session | null }
  | { status: 'unavailable' };

async function readBrowserSession(
  supabase: ReturnType<typeof getSupabaseBrowser>,
): Promise<BrowserSessionRead> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { status: 'unavailable' };
    return { status: 'available', session: data.session ?? null };
  } catch {
    return { status: 'unavailable' };
  }
}

type CachedRole = {
  userId: string;
  role: PortalRole;
  verifiedAt: number;
};

function readCachedRole(userId: string): CachedRole | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedRole>;
    if (parsed.userId !== userId) return null;
    if (parsed.role !== 'admin' && parsed.role !== 'staff') return null;
    if (typeof parsed.verifiedAt !== 'number' || !Number.isFinite(parsed.verifiedAt)) return null;
    return { userId: parsed.userId, role: parsed.role, verifiedAt: parsed.verifiedAt };
  } catch {
    window.localStorage.removeItem(ROLE_CACHE_KEY);
    return null;
  }
}

function writeCachedRole(entry: CachedRole) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(entry));
  } catch {
    void 0;
  }
}

function clearCachedRole() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ROLE_CACHE_KEY);
  } catch {
    void 0;
  }
}

type PortalAuthState = {
  status: PortalAuthStatus;
  user: PortalAuthUser | null;
  role: PortalRole | null;
  email: string | null;
  isAdmin: boolean;
  signOut: (redirectTo?: string) => Promise<'signed_out' | 'cancelled'>;
  refresh: () => Promise<void>;
};

export const PortalAuthContext = createContext<PortalAuthState | null>(null);

export default function PortalAuthProvider({
  children,
  initialAuthState,
  requestAdmission,
}: {
  children: React.ReactNode;
  initialAuthState?: PortalAuthInitialState;
  /** A live, freshly guarded opening response. Browser sessions can invalidate
   * this identity, but never supply its actor or current role. */
  requestAdmission?: {state: PortalAuthInitialState; invalidate: () => void};
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const applyNonceRef = useRef(0);
  const [state, setState] = useState<{ status: PortalAuthStatus; user: PortalAuthUser | null; role: PortalRole | null }>(
    initialAuthState ?? {
      status: 'loading',
      user: null,
      role: null,
    },
  );
  const visibleState = requestAdmission?.state ?? state;
  const stateRef = useRef(visibleState);
  const admissionRef = useRef(requestAdmission);
  admissionRef.current = requestAdmission;
  const requestAdmitted=Boolean(requestAdmission);

  useEffect(() => {
    stateRef.current = visibleState;
  }, [visibleState]);

  const applySession = useCallback(
    async (session: Session | null) => {
      const applyNonce = (applyNonceRef.current += 1);
      const stillCurrent = () => applyNonceRef.current === applyNonce;

      if (!session?.user) {
        clearLegacyUnscopedCalculatorSessionDrafts();
        clearCachedRole();
        setState({ status: 'unauthenticated', user: null, role: null });
        return;
      }

      const user = toPortalAuthUser(session.user);
      const cached = readCachedRole(user.id);
      const previousState = stateRef.current;
      const sameUser = previousState.user?.id === user.id;
      if (previousState.user?.id && !sameUser) clearLegacyUnscopedCalculatorSessionDrafts();

      if (cached?.role) {
        setState({ status: 'authenticated', user, role: cached.role });
      } else if (!(sameUser && previousState.status !== 'unauthenticated')) {
        setState({ status: 'loading', user, role: null });
      }

      let role: PortalRole | null = null;
      try {
        role = await fetchPortalRole(user.id);
      } catch {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) throw error;
          role = await fetchPortalRole(data.session?.user?.id ?? user.id);
        } catch {
          // Transient failure (offline / Safari resume / token race). Keep cached role if we have it.
          if (!stillCurrent()) return;
          if (cached?.role) {
            setState({ status: 'authenticated', user, role: cached.role });
          } else {
            setState({ status: 'lookup_failed', user, role: null });
          }
          return;
        }
      }

      if (!stillCurrent()) return;
      if (!role) {
        clearCachedRole();
        setState({ status: 'no_access', user, role: null });
        return;
      }

      writeCachedRole({ userId: user.id, role, verifiedAt: Date.now() });
      setState({ status: 'authenticated', user, role });
    },
    [supabase],
  );

  const refresh = useCallback(async () => {
    if (admissionRef.current) { admissionRef.current.invalidate(); return; }
    const result = await readBrowserSession(supabase);
    if (result.status === 'unavailable') {
      const currentState = stateRef.current;
      if (currentState.status === 'loading') {
        setState({ status: 'lookup_failed', user: currentState.user, role: null });
      }
      return;
    }
    await applySession(result.session);
  }, [applySession, supabase]);

  const signOut = useCallback(
    async (redirectTo?: string) => {
      const currentUserId = stateRef.current.user?.id ?? null;
      const ownsLocalState = Boolean(currentUserId && getLocalFirstStoreOwner() === currentUserId);
      const summary = ownsLocalState
        ? summarizeLocalFirstStoreState(getLocalFirstStoreSnapshot().state)
        : null;
      const retainedWork = Boolean(
        summary &&
        (summary.pendingCount > 0 ||
          summary.conflictCount > 0 ||
          summary.errorCount > 0 ||
          summary.workingCopyCount > 0),
      );
      let discard = false;

      if (summary?.syncingCount) {
        discard = window.confirm(
          'Some changes are still saving. Select OK to discard this device\'s unsaved changes and sign out, or Cancel to stay signed in and let saving finish.',
        );
        if (!discard) return 'cancelled';
      } else if (retainedWork) {
        const keepForLater = window.confirm(
          'This device has changes that are not fully synced. Select OK to keep them for your next sign-in and sign out, or Cancel to stay signed in.',
        );
        if (!keepForLater) return 'cancelled';
      }

      if (ownsLocalState) {
        stopLocalFirstRuntime({ clearOwner: false });
        if (discard) await discardAllLocalFirstState();
        clearLocalFirstStoreOwner();
      }
      clearLegacyUnscopedCalculatorSessionDrafts();
      clearCachedRole();
      await supabase.auth.signOut();
      setState({ status: 'unauthenticated', user: null, role: null });
      if (redirectTo) router.replace(redirectTo);
      return 'signed_out';
    },
    [router, supabase],
  );

  useEffect(() => {
    let active = true;

    if (requestAdmitted) {
      // The document entry owner already observes transitions BEFORE its fresh
      // read. Mounting this provider must not read cached hints, veto a fresh
      // server identity, or create an INITIAL_SESSION/refetch/remount loop.
      return () => { active=false;applyNonceRef.current++; };
    }

    void (async () => {
      const result = await readBrowserSession(supabase);
      if (!active) return;
      if (result.status === 'unavailable') {
        const currentState = stateRef.current;
        if (currentState.status === 'loading') {
          setState({ status: 'lookup_failed', user: currentState.user, role: null });
        }
        return;
      }
      await applySession(result.session);
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session ?? null);
    });

    return () => {
      active = false;
      applyNonceRef.current++;
      data.subscription.unsubscribe();
    };
  }, [applySession, supabase, requestAdmitted]);

  const email = visibleState.user?.email ?? null;
  useEffect(() => {
    setProjectIndexSession(visibleState.user?.id ?? null, supabaseRuntimeUrl());
    return () => setProjectIndexSession(null, '');
  }, [visibleState.user?.id]);
  const isAdmin = visibleState.role === 'admin';

  return (
    <PortalAuthContext.Provider
      value={{
        status: visibleState.status,
        user: visibleState.user,
        role: visibleState.role,
        email,
        isAdmin,
        signOut,
        refresh,
      }}
    >
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalSession() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalSession must be used within PortalAuthProvider');
  return ctx;
}
