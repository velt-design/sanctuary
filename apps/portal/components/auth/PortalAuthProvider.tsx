'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browserClient';
import { fetchPortalRole } from '@/lib/queries/auth';
import type { PortalRole } from '@/lib/authTypes';
import { type PortalAuthInitialState, type PortalAuthStatus, type PortalAuthUser, toPortalAuthUser } from '@/lib/portalAccess';

const ROLE_CACHE_KEY = 'sanctuary-portal:portal-role-cache:v1';

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
  signOut: (redirectTo?: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const PortalAuthContext = createContext<PortalAuthState | null>(null);

export default function PortalAuthProvider({
  children,
  initialAuthState,
}: {
  children: React.ReactNode;
  initialAuthState?: PortalAuthInitialState;
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
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const applySession = useCallback(
    async (session: Session | null) => {
      const applyNonce = (applyNonceRef.current += 1);
      const stillCurrent = () => applyNonceRef.current === applyNonce;

      if (!session?.user) {
        clearCachedRole();
        setState({ status: 'unauthenticated', user: null, role: null });
        return;
      }

      const user = toPortalAuthUser(session.user);
      const cached = readCachedRole(user.id);
      const previousState = stateRef.current;
      const sameUser = previousState.user?.id === user.id;

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
    const { data } = await supabase.auth.getSession();
    await applySession(data.session ?? null);
  }, [applySession, supabase]);

  const signOut = useCallback(
    async (redirectTo?: string) => {
      clearCachedRole();
      await supabase.auth.signOut();
      setState({ status: 'unauthenticated', user: null, role: null });
      if (redirectTo) router.replace(redirectTo);
    },
    [router, supabase],
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      await applySession(data.session ?? null);
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session ?? null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [applySession, supabase]);

  const email = state.user?.email ?? null;
  const isAdmin = state.role === 'admin';

  return (
    <PortalAuthContext.Provider
      value={{
        status: state.status,
        user: state.user,
        role: state.role,
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
