'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browserClient';
import type { PortalRole } from '@/lib/authTypes';

type PortalAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type PortalAuthState = {
  status: PortalAuthStatus;
  user: User | null;
  role: PortalRole | null;
  email: string | null;
  isAdmin: boolean;
  signOut: (redirectTo?: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const PortalAuthContext = createContext<PortalAuthState | null>(null);

async function fetchRole(userId: string): Promise<PortalRole | null> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.from('portal_users').select('role').eq('user_id', userId).maybeSingle();
  if (error || !data?.role) return null;
  return data.role === 'admin' ? 'admin' : 'staff';
}

export default function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [state, setState] = useState<{ status: PortalAuthStatus; user: User | null; role: PortalRole | null }>({
    status: 'loading',
    user: null,
    role: null,
  });

  const applySession = useCallback(
    async (session: Session | null) => {
      if (!session?.user) {
        setState({ status: 'unauthenticated', user: null, role: null });
        return;
      }

      setState((prev) => ({ ...prev, status: 'loading', user: session.user }));
      const role = await fetchRole(session.user.id);
      if (!role) {
        await supabase.auth.signOut();
        setState({ status: 'unauthenticated', user: null, role: null });
        return;
      }

      setState({ status: 'authenticated', user: session.user, role });
    },
    [supabase],
  );

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await applySession(data.session ?? null);
  }, [applySession, supabase]);

  const signOut = useCallback(
    async (redirectTo?: string) => {
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
