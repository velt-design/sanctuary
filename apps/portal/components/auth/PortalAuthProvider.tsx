'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowser, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { fetchPortalRole } from '@/lib/queries/auth';
import type { PortalRole } from '@/lib/authTypes';
import {
  buildAccessStatusHref,
  buildLoginHref,
  type PortalAuthInitialState,
  type PortalAuthStatus,
  type PortalAuthUser,
  toPortalAuthUser,
} from '@/lib/portalAccess';
import {
  bindLocalFirstStoreOwner,
  ensureLocalFirstStoreReady,
  getLocalFirstStoreOwner,
  getLocalFirstStoreSnapshot,
  summarizeLocalFirstStoreState,
} from '@/lib/localFirst/store';
import { clearLegacyUnscopedCalculatorSessionDrafts } from '@/lib/localFirst/sessionBoundary';
import {
  installPortalRetainedWorkResponder,
  queryPortalOwnerRetainedWork,
} from '@/lib/localFirst/portalRetainedWorkBoundary';
import {
  purgePortalLegacyUnscopedBrowserData,
  purgePortalOwnerScopedBrowserData,
} from '@/lib/portalBrowserDataBoundary';
import {
  beginPortalCleanupQuarantine,
  completePortalCleanupQuarantine,
  PortalCleanupQuarantinePersistenceError,
} from '@/lib/portalCleanupQuarantine';
import {
  currentPortalDocumentHref,
  replacePortalDocument,
} from '@/lib/portalDocumentNavigation';
import {
  installPortalApiAccessFailureMonitor,
  type PortalApiAccessFailure,
} from '@/lib/portalApiAccessMonitor';
import { clearPortalSupabaseBrowserSession } from '@/lib/portalSupabaseSessionBoundary';
import {
  publishPortalAuthBoundary,
  subscribeToPortalAuthBoundary,
} from '@/lib/portalAuthBoundaryChannel';

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
    clearCachedRole();
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
  signOut: (redirectTo?: string) => Promise<'signed_out' | 'cancelled' | 'failed'>;
  refresh: () => Promise<void>;
};

type PortalAuthCoreState = Pick<PortalAuthState, 'status' | 'user' | 'role'>;

function reportOwnerPurgeFailure(context: string, error: unknown): void {
  console.error(`[portal-auth] ${context}: browser data could not be fully cleared.`, error);
}

function reportSignOutFailure(error: unknown): void {
  console.error('[portal-auth] Supabase sign-out failed; the portal was locked locally.', error);
}

async function completeRequiredPortalBrowserCleanup(
  departingOwnerId: string | null,
): Promise<void> {
  // This call persists the reload-safe marker synchronously before either
  // asynchronous cleanup operation is allowed to start.
  const quarantine = beginPortalCleanupQuarantine(departingOwnerId);
  const cleanupResults = await Promise.allSettled([
    purgePortalLegacyUnscopedBrowserData(),
    quarantine.departingOwnerId
      ? purgePortalOwnerScopedBrowserData(quarantine.departingOwnerId)
      : Promise.resolve(),
  ]);
  const failures = cleanupResults.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failures.length) {
    throw new Error('Portal browser cleanup remains quarantined.', {
      cause: failures.map((result) => result.reason),
    });
  }
  // If another tab strengthened/replaced the marker while cleanup was in
  // flight, completion throws and the portal stays locked for another pass.
  completePortalCleanupQuarantine(quarantine);
}

const PortalAuthContext = createContext<PortalAuthState | null>(null);

export default function PortalAuthProvider({
  children,
  initialAuthState,
}: {
  children: React.ReactNode;
  initialAuthState?: PortalAuthInitialState;
}) {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const applyNonceRef = useRef(0);
  const accessVerificationPendingRef = useRef(false);
  const documentResetPendingRef = useRef(false);
  const browserCleanupVerifiedOwnerRef = useRef<string | null>(null);
  const signOutAttemptRef = useRef<{ token: number; ownerId: string | null } | null>(null);
  const [state, setState] = useState<PortalAuthCoreState>(() => {
    const initial = initialAuthState ?? {
      status: 'loading',
      user: null,
      role: null,
    } satisfies PortalAuthCoreState;
    // Even a server-verified snapshot cannot mount browser-resident owner data
    // until this fresh document has completed the cleanup quarantine gate.
    return initial.status === 'authenticated'
      ? { ...initial, status: 'loading' }
      : initial;
  });
  const stateRef = useRef(state);
  const commitState = useCallback((next: PortalAuthCoreState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const applySession = useCallback(
    async (session: Session | null) => {
      if (documentResetPendingRef.current) return;
      // No auth event may unlock this document once sign-out has started.
      // A replacement owner is allowed only after the hard document reset.
      if (signOutAttemptRef.current) return;

      const applyNonce = (applyNonceRef.current += 1);
      const stillCurrent = () => applyNonceRef.current === applyNonce;

      if (!session?.user) {
        const previousOwnerId = stateRef.current.user?.id ?? null;
        const cleanupPromise = previousOwnerId
          ? completeRequiredPortalBrowserCleanup(previousOwnerId)
          : null;
        browserCleanupVerifiedOwnerRef.current = null;
        if (previousOwnerId) {
          // Latch the document boundary before the purge yields. Supabase can
          // emit SIGNED_OUT(A) followed immediately by SIGNED_IN(B); clearing
          // state first would otherwise let B bypass the owner-change reset
          // while A's Router/RSC document is still mounted.
          documentResetPendingRef.current = true;
        }
        if (previousOwnerId) publishPortalAuthBoundary(previousOwnerId, 'signed-out');
        clearCachedRole();
        commitState({ status: 'loading', user: null, role: null });
        let cleanupIsReloadSafe = true;
        if (previousOwnerId) {
          try {
            await cleanupPromise;
          } catch (error) {
            reportOwnerPurgeFailure('Session ended', error);
            cleanupIsReloadSafe = !(error instanceof PortalCleanupQuarantinePersistenceError);
          }
        } else {
          try {
            clearLegacyUnscopedCalculatorSessionDrafts();
          } catch (error) {
            reportOwnerPurgeFailure('Session ended', error);
          }
        }
        if (!stillCurrent()) return;
        if (!cleanupIsReloadSafe) return;
        commitState({ status: 'unauthenticated', user: null, role: null });
        if (previousOwnerId) {
          documentResetPendingRef.current = true;
          applyNonceRef.current += 1;
          replacePortalDocument(buildLoginHref(currentPortalDocumentHref()));
        }
        return;
      }

      const user = toPortalAuthUser(session.user);
      const cached = readCachedRole(user.id);
      const previousState = stateRef.current;
      const sameUser = previousState.user?.id === user.id;
      if (previousState.user?.id && !sameUser) {
        const cleanupPromise = completeRequiredPortalBrowserCleanup(previousState.user.id);
        browserCleanupVerifiedOwnerRef.current = null;
        // Gate every later auth event immediately. A second TOKEN_REFRESHED
        // event for user B must not mount B before user A is purged and the
        // old Router/RSC document is discarded.
        documentResetPendingRef.current = true;
        publishPortalAuthBoundary(previousState.user.id, 'owner-changed');
        commitState({
          status: 'loading',
          user,
          role: (sameUser ? previousState.role : null) ?? cached?.role ?? null,
        });
        try {
          await cleanupPromise;
        } catch (error) {
          reportOwnerPurgeFailure('Portal user changed', error);
          if (stillCurrent()) {
            commitState({ status: 'lookup_failed', user, role: null });
          }
          return;
        }
        if (!stillCurrent()) return;
        applyNonceRef.current += 1;
        replacePortalDocument(currentPortalDocumentHref(), '/dashboard');
        return;
      }

      if (browserCleanupVerifiedOwnerRef.current !== user.id) {
        // A fresh document may have legacy, pre-owner storage even though no
        // departing user exists in React state. Keep all data providers locked
        // until legacy cleanup and any reload-surviving quarantine both pass.
        commitState({
          status: 'loading',
          user,
          role: (sameUser ? previousState.role : null) ?? cached?.role ?? null,
        });
        try {
          await completeRequiredPortalBrowserCleanup(null);
        } catch (error) {
          reportOwnerPurgeFailure('Portal entry cleanup', error);
          if (stillCurrent()) {
            commitState({ status: 'lookup_failed', user, role: null });
          }
          return;
        }
        if (!stillCurrent()) return;
        browserCleanupVerifiedOwnerRef.current = user.id;
      }

      // A cached role is a data-free presentation hint only. Persisted owner data
      // remains unmounted until the current browser session completes a live role read.
      const retainVerifiedOwner = sameUser
        && previousState.status === 'authenticated'
        && Boolean(previousState.role);
      if (!retainVerifiedOwner) {
        if (cached?.role) {
          commitState({ status: 'loading', user, role: cached.role });
        } else if (!(sameUser && previousState.status !== 'unauthenticated')) {
          commitState({ status: 'loading', user, role: null });
        }
      }

      let role: PortalRole | null = null;
      try {
        role = await fetchPortalRole(user.id);
      } catch {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) throw error;
          const refreshedUserId = data.session?.user?.id ?? null;
          if (refreshedUserId !== user.id) {
            throw new Error('Portal session owner changed during token refresh.');
          }
          role = await fetchPortalRole(user.id);
        } catch {
          // Transient failure (offline / Safari resume / token race). A cached role
          // may preserve the visual shell, but must never unlock owner-scoped data.
          if (!stillCurrent()) return;
          if (retainVerifiedOwner && previousState.role) {
            commitState({ status: 'authenticated', user, role: previousState.role });
          } else if (cached?.role) {
            commitState({ status: 'loading', user, role: cached.role });
          } else {
            commitState({ status: 'lookup_failed', user, role: null });
          }
          return;
        }
      }

      if (!stillCurrent()) return;
      if (!role) {
        const resetVerifiedOwnerDocument = Boolean(previousState.role);
        const cleanupPromise = completeRequiredPortalBrowserCleanup(user.id);
        browserCleanupVerifiedOwnerRef.current = null;
        if (resetVerifiedOwnerDocument) {
          // Access loss is also a hard boundary. Ignore a later auth event
          // until this owner's data is purged and the old document is gone.
          documentResetPendingRef.current = true;
        }
        clearCachedRole();
        publishPortalAuthBoundary(user.id, 'access-lost');
        commitState({ status: 'loading', user, role: null });
        let cleanupIsReloadSafe = true;
        try {
          await cleanupPromise;
        } catch (error) {
          reportOwnerPurgeFailure('Portal access ended', error);
          cleanupIsReloadSafe = !(error instanceof PortalCleanupQuarantinePersistenceError);
        }
        if (!stillCurrent()) return;
        if (!cleanupIsReloadSafe) return;
        commitState({ status: 'no_access', user, role: null });
        if (resetVerifiedOwnerDocument) {
          applyNonceRef.current += 1;
          replacePortalDocument(buildAccessStatusHref({
            state: 'no-access',
            callbackUrl: currentPortalDocumentHref(),
          }));
        }
        return;
      }

      if (previousState.role && previousState.role !== role) {
        // Role changes are identity-boundary changes for in-memory admin data.
        // Lock providers and discard the complete Router/RSC document before
        // entering any route under the newly verified role.
        writeCachedRole({ userId: user.id, role, verifiedAt: Date.now() });
        publishPortalAuthBoundary(user.id, 'role-changed');
        commitState({ status: 'loading', user, role });
        documentResetPendingRef.current = true;
        applyNonceRef.current += 1;
        replacePortalDocument('/dashboard');
        return;
      }

      writeCachedRole({ userId: user.id, role, verifiedAt: Date.now() });
      commitState({ status: 'authenticated', user, role });
    },
    [commitState, supabase],
  );

  const refresh = useCallback(async () => {
    const readNonce = applyNonceRef.current;
    const result = await readBrowserSession(supabase);
    if (readNonce !== applyNonceRef.current) return;
    if (result.status === 'unavailable') {
      const currentState = stateRef.current;
      if (currentState.status === 'loading') {
        commitState({ status: 'lookup_failed', user: currentState.user, role: null });
      }
      return;
    }
    await applySession(result.session);
  }, [applySession, commitState, supabase]);

  const requestAccessVerification = useCallback(
    (options?: { lockOwnerData?: boolean }) => {
      const currentState = stateRef.current;
      if (
        documentResetPendingRef.current
        || signOutAttemptRef.current
        || (!currentState.user && currentState.status === 'unauthenticated')
      ) return;

      if (options?.lockOwnerData && currentState.status === 'authenticated') {
        commitState({
          status: 'loading',
          user: currentState.user,
          role: currentState.role,
        });
      }
      if (accessVerificationPendingRef.current) return;
      accessVerificationPendingRef.current = true;
      void refresh().finally(() => {
        accessVerificationPendingRef.current = false;
      });
    },
    [commitState, refresh],
  );

  const handleApiAccessFailure = useCallback(
    (failure: PortalApiAccessFailure) => {
      // A 401 must stop data-bearing providers immediately. A 403 can be an
      // endpoint-specific denial, so live-check the role without assuming
      // whole-portal access ended.
      requestAccessVerification({ lockOwnerData: failure.status === 401 });
    },
    [requestAccessVerification],
  );

  const signOut = useCallback(
    async (redirectTo?: string) => {
      const previousAuthState = stateRef.current;
      const currentUserId = previousAuthState.user?.id ?? null;
      let summary: ReturnType<typeof summarizeLocalFirstStoreState> | null = null;
      let draftInspectionFailed = false;
      if (currentUserId) {
        try {
          const localFirstOwnerId = getLocalFirstStoreOwner();
          if (!localFirstOwnerId) {
            bindLocalFirstStoreOwner(currentUserId);
          } else if (localFirstOwnerId !== currentUserId) {
            throw new Error('The local-first owner did not match the signed-in portal user.');
          }
          // Hydration can still be in flight immediately after login. Never
          // decide that there is no retained work from the initial empty snapshot.
          await ensureLocalFirstStoreReady();
          summary = summarizeLocalFirstStoreState(getLocalFirstStoreSnapshot().state);
        } catch (error) {
          draftInspectionFailed = true;
          reportOwnerPurgeFailure('Sign out draft inspection', error);
        }
      }
      let retainedWork = Boolean(
        draftInspectionFailed ||
        (summary &&
          (summary.pendingCount > 0 ||
          summary.conflictCount > 0 ||
          summary.errorCount > 0 ||
          summary.workingCopyCount > 0)),
      );
      const syncingCount = summary?.syncingCount ?? 0;

      if (currentUserId && !retainedWork) {
        const crossTabStatus = await queryPortalOwnerRetainedWork(currentUserId);
        retainedWork = crossTabStatus !== 'clear';
        if (crossTabStatus === 'unknown') draftInspectionFailed = true;
      }

      if (syncingCount || retainedWork) {
        const discard = window.confirm(
          syncingCount
            ? 'Some changes are still saving. Select OK to permanently discard this device\'s unsaved changes and sign out, or Cancel to stay signed in and let saving finish.'
            : draftInspectionFailed
              ? 'This device\'s saved drafts could not be checked. Select OK to permanently clear them and sign out, or Cancel to stay signed in.'
            : 'This device has changes that are not fully synced. Select OK to permanently discard them and sign out, or Cancel to stay signed in.',
        );
        if (!discard) return 'cancelled';
      }

      const signOutToken = applyNonceRef.current + 1;
      applyNonceRef.current = signOutToken;
      signOutAttemptRef.current = { token: signOutToken, ownerId: currentUserId };
      const purgePromise = currentUserId
        ? completeRequiredPortalBrowserCleanup(currentUserId)
        : Promise.resolve().then(() => clearLegacyUnscopedCalculatorSessionDrafts());
      browserCleanupVerifiedOwnerRef.current = null;
      if (currentUserId) publishPortalAuthBoundary(currentUserId, 'signed-out');
      commitState({ status: 'loading', user: null, role: null });
      clearCachedRole();

      const signOutPromise = Promise.resolve().then(() => supabase.auth.signOut());
      const [purgeResult, signOutResult] = await Promise.allSettled([purgePromise, signOutPromise]);

      if (purgeResult.status === 'rejected') {
        reportOwnerPurgeFailure('Sign out', purgeResult.reason);
      }
      const cleanupIsReloadSafe = !(
        purgeResult.status === 'rejected'
        && purgeResult.reason instanceof PortalCleanupQuarantinePersistenceError
      );

      let signOutFailed = signOutResult.status === 'rejected' || Boolean(signOutResult.value?.error);
      if (signOutFailed) {
        const signOutError = signOutResult.status === 'rejected'
          ? signOutResult.reason
          : signOutResult.value.error;
        try {
          const localResult = await supabase.auth.signOut({ scope: 'local' });
          if (localResult.error) throw localResult.error;
          signOutFailed = false;
        } catch (localError) {
          reportSignOutFailure(localError ?? signOutError);
        }
      }

      if (signOutFailed) {
        try {
          await supabase.auth.stopAutoRefresh();
        } catch {
          void 0;
        }
        try {
          clearPortalSupabaseBrowserSession(supabaseRuntimeUrl());
        } catch (error) {
          reportSignOutFailure(error);
        }
        const localSession = await readBrowserSession(supabase);
        if (localSession.status !== 'available' || localSession.session) {
          // Keep the current document locally locked. Navigating with a live
          // SSR cookie could immediately mount the signed-in portal again.
          reportSignOutFailure(new Error('The local portal session could not be removed.'));
          return 'failed';
        }
      }

      if (!cleanupIsReloadSafe) {
        // The auth session may already be revoked, but without either durable
        // marker a replacement document could not recover the departing owner.
        // Keep this document permanently locked instead of navigating.
        documentResetPendingRef.current = true;
        return 'failed';
      }

      if (signOutAttemptRef.current?.token === signOutToken) {
        signOutAttemptRef.current = null;
      }
      commitState({ status: 'unauthenticated', user: null, role: null });
      documentResetPendingRef.current = true;
      replacePortalDocument(redirectTo ?? '/login');
      return 'signed_out';
    },
    [commitState, supabase],
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const readNonce = applyNonceRef.current;
      const result = await readBrowserSession(supabase);
      if (!active || readNonce !== applyNonceRef.current) return;
      if (result.status === 'unavailable') {
        const currentState = stateRef.current;
        if (currentState.status === 'loading') {
          commitState({ status: 'lookup_failed', user: currentState.user, role: null });
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
      applyNonceRef.current += 1;
      data.subscription.unsubscribe();
    };
  }, [applySession, commitState, supabase]);

  useEffect(
    () => installPortalApiAccessFailureMonitor(handleApiAccessFailure),
    [handleApiAccessFailure],
  );

  useEffect(() => installPortalRetainedWorkResponder(), []);

  useEffect(
    () => subscribeToPortalAuthBoundary((boundary) => {
      const currentOwnerId = stateRef.current.user?.id ?? null;
      if (
        documentResetPendingRef.current
        || !currentOwnerId
        || currentOwnerId !== boundary.ownerId
      ) return;

      const cleanupPromise = boundary.reason === 'role-changed'
        ? null
        : completeRequiredPortalBrowserCleanup(currentOwnerId);
      browserCleanupVerifiedOwnerRef.current = null;
      documentResetPendingRef.current = true;
      applyNonceRef.current += 1;
      clearCachedRole();
      commitState({ status: 'loading', user: null, role: null });
      const target = boundary.reason === 'access-lost'
        ? buildAccessStatusHref({
            state: 'no-access',
            callbackUrl: currentPortalDocumentHref(),
          })
        : boundary.reason === 'signed-out'
          ? buildLoginHref(currentPortalDocumentHref())
          : '/dashboard';
      if (boundary.reason === 'role-changed') {
        replacePortalDocument(target);
        return;
      }
      if (!cleanupPromise) return;
      void cleanupPromise
        .then(() => replacePortalDocument(target))
        .catch((error) => {
          reportOwnerPurgeFailure('Remote auth boundary', error);
          if (!(error instanceof PortalCleanupQuarantinePersistenceError)) {
            replacePortalDocument(target);
          }
        });
    }),
    [commitState],
  );

  useEffect(() => {
    const verifyVisibleAccess = () => {
      if (document.visibilityState === 'hidden') return;
      requestAccessVerification();
    };
    const interval = window.setInterval(verifyVisibleAccess, 60_000);
    window.addEventListener('focus', verifyVisibleAccess);
    window.addEventListener('online', verifyVisibleAccess);
    document.addEventListener('visibilitychange', verifyVisibleAccess);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', verifyVisibleAccess);
      window.removeEventListener('online', verifyVisibleAccess);
      document.removeEventListener('visibilitychange', verifyVisibleAccess);
    };
  }, [requestAccessVerification]);

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
