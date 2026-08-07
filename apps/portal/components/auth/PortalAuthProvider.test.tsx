import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalAuthProvider, { usePortalSession } from './PortalAuthProvider';
import { renderIntoDocument } from '../../../../test/reactHarness';
import {
  __resetLocalFirstStoreForTests,
  __setLocalFirstStorageAdapterForTests,
  bindLocalFirstStoreOwner,
  clearLocalFirstStoreOwner,
  createEmptyLocalFirstState,
  enqueueLocalFirstMutation,
  ensureLocalFirstStoreReady,
  getLocalFirstStoreSnapshot,
  markLocalFirstQueueItemSyncing,
} from '@/lib/localFirst/store';
import type { LocalFirstPersistedState } from '@/lib/localFirst/types';
import {
  beginPortalCleanupQuarantine,
  portalCleanupQuarantineCookieName,
  portalCleanupQuarantineStorageKey,
} from '@/lib/portalCleanupQuarantine';

const replaceMock = vi.fn();
const fetchPortalRoleMock = vi.fn();
const getSessionMock = vi.fn();
const refreshSessionMock = vi.fn();
const signOutMock = vi.fn();
const stopAutoRefreshMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
let authStateChangeCallback: ((event: string, session: unknown) => void) | null = null;
const { deleteIndexedDbKeyMock } = vi.hoisted(() => ({
  deleteIndexedDbKeyMock: vi.fn(),
}));
const { queryRetainedWorkMock } = vi.hoisted(() => ({
  queryRetainedWorkMock: vi.fn(),
}));

vi.mock('@/lib/localFirst/portalRetainedWorkBoundary', () => ({
  installPortalRetainedWorkResponder: () => () => {},
  queryPortalOwnerRetainedWork: (...args: unknown[]) => queryRetainedWorkMock(...args),
}));

vi.mock('idb-keyval', async (importOriginal) => ({
  ...(await importOriginal<typeof import('idb-keyval')>()),
  del: (...args: unknown[]) => deleteIndexedDbKeyMock(...args),
}));

vi.mock('@/lib/portalDocumentNavigation', () => ({
  currentPortalDocumentHref: () => '/staff/projects',
  replacePortalDocument: (...args: unknown[]) => replaceMock(...args),
}));

vi.mock('@/lib/queries/auth', () => ({
  fetchPortalRole: (...args: unknown[]) => fetchPortalRoleMock(...args),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  getSupabaseBrowser: () => ({
    auth: {
      getSession: () => getSessionMock(),
      refreshSession: () => refreshSessionMock(),
      signOut: (...args: unknown[]) => signOutMock(...args),
      stopAutoRefresh: () => stopAutoRefreshMock(),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
  }),
}));

function SessionProbe() {
  const session = usePortalSession();
  return (
    <div data-status={session.status} data-role={session.role ?? ''} data-email={session.email ?? ''}>
      <button data-action="sign-out" type="button" onClick={() => void session.signOut('/staff/login')}>Sign out probe</button>
      <button data-action="refresh" type="button" onClick={() => void session.refresh()}>Refresh probe</button>
    </div>
  );
}

describe('PortalAuthProvider', () => {
  let persisted: LocalFirstPersistedState;

  beforeEach(() => {
    replaceMock.mockReset();
    fetchPortalRoleMock.mockReset();
    getSessionMock.mockReset();
    refreshSessionMock.mockReset();
    signOutMock.mockReset();
    stopAutoRefreshMock.mockReset().mockResolvedValue(undefined);
    onAuthStateChangeMock.mockReset();
    deleteIndexedDbKeyMock.mockReset().mockResolvedValue(undefined);
    queryRetainedWorkMock.mockReset().mockResolvedValue('clear');
    authStateChangeCallback = null;
    window.localStorage.clear();
    document.cookie = `${portalCleanupQuarantineCookieName}=; Path=/; Max-Age=0; SameSite=Strict`;

    fetchPortalRoleMock.mockResolvedValue('admin');
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user_1',
            email: 'ops@example.com',
          },
        },
      },
    });
    refreshSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user_1',
            email: 'ops@example.com',
          },
        },
      },
      error: null,
    });
    signOutMock.mockResolvedValue(undefined);
    onAuthStateChangeMock.mockImplementation((callback: typeof authStateChangeCallback) => {
      authStateChangeCallback = callback;
      return {
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
      };
    });
    persisted = createEmptyLocalFirstState();
    __setLocalFirstStorageAdapterForTests({
      get: async () => structuredClone(persisted),
      set: async (state) => { persisted = structuredClone(state); },
    });
    __resetLocalFirstStoreForTests();
  });

  afterEach(() => {
    clearLocalFirstStoreOwner();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('keeps a server-authenticated snapshot presentation-only until fresh-document cleanup succeeds', async () => {
    let finishLegacyDelete: (() => void) | null = null;
    deleteIndexedDbKeyMock.mockImplementation((key: unknown) => {
      if (key === 'sanctuary-portal-local-first-v1') {
        return new Promise<void>((resolve) => { finishLegacyDelete = resolve; });
      }
      return Promise.resolve();
    });
    const rendered = renderIntoDocument(
      <PortalAuthProvider
        initialAuthState={{
          status: 'authenticated',
          user: { id: 'user_1', email: 'ops@example.com' },
          role: 'admin',
        }}
      >
        <SessionProbe />
      </PortalAuthProvider>,
    );

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(probe.dataset.role).toBe('admin');
    expect(probe.dataset.email).toBe('ops@example.com');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(fetchPortalRoleMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(portalCleanupQuarantineStorageKey)).toBeTruthy();

    await act(async () => {
      finishLegacyDelete?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(probe.dataset.status).toBe('authenticated');
    expect(fetchPortalRoleMock).toHaveBeenCalledWith('user_1');

    rendered.unmount();
  });

  it('keeps a server-known session locked when the browser session cannot be verified', async () => {
    getSessionMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const rendered = renderIntoDocument(
      <PortalAuthProvider
        initialAuthState={{
          status: 'authenticated',
          user: { id: 'user_1', email: 'ops@example.com' },
          role: 'admin',
        }}
      >
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('lookup_failed');
    expect(probe.dataset.role).toBe('');
    expect(probe.dataset.email).toBe('ops@example.com');
    expect(fetchPortalRoleMock).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('keeps the verified owner mounted during routine same-user token refresh', async () => {
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    let resolveRecheck: ((role: 'admin') => void) | null = null;
    fetchPortalRoleMock.mockReturnValueOnce(new Promise<'admin'>((resolve) => {
      resolveRecheck = resolve;
    }));
    await act(async () => {
      authStateChangeCallback?.('TOKEN_REFRESHED', {
        user: { id: 'user_1', email: 'ops@example.com' },
      });
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('authenticated');
    expect(probe.dataset.role).toBe('admin');

    await act(async () => {
      resolveRecheck?.('admin');
      await Promise.resolve();
    });
    expect(probe.dataset.status).toBe('authenticated');
    rendered.unmount();
  });

  it('uses a cached role only as a presentation hint until live verification succeeds', async () => {
    let resolveRole: ((role: 'admin') => void) | null = null;
    fetchPortalRoleMock.mockReturnValue(new Promise<'admin'>((resolve) => {
      resolveRole = resolve;
    }));
    window.localStorage.setItem('sanctuary-portal:portal-role-cache:v1', JSON.stringify({
      userId: 'user_1',
      role: 'admin',
      verifiedAt: Date.now(),
    }));

    const rendered = renderIntoDocument(
      <PortalAuthProvider>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(probe.dataset.role).toBe('admin');

    await act(async () => {
      resolveRole?.('admin');
      await Promise.resolve();
    });

    expect(probe.dataset.status).toBe('authenticated');
    rendered.unmount();
  });

  it('keeps a fresh owner locked until legacy unscoped storage is fully cleared', async () => {
    let finishLegacyDelete: (() => void) | null = null;
    deleteIndexedDbKeyMock.mockImplementation((key: unknown) => {
      if (key === 'sanctuary-portal-local-first-v1') {
        return new Promise<void>((resolve) => { finishLegacyDelete = resolve; });
      }
      return Promise.resolve();
    });
    window.localStorage.setItem('sp_contacts_v1', 'departing-customer');
    window.localStorage.setItem('sp_projects_v1', 'departing-project');

    const rendered = renderIntoDocument(
      <PortalAuthProvider>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(fetchPortalRoleMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('sp_contacts_v1')).toBeNull();
    expect(window.localStorage.getItem(portalCleanupQuarantineStorageKey)).toBeTruthy();

    await act(async () => {
      finishLegacyDelete?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(probe.dataset.status).toBe('authenticated');
    expect(fetchPortalRoleMock).toHaveBeenCalledWith('user_1');
    expect(window.localStorage.getItem(portalCleanupQuarantineStorageKey)).toBeNull();
    rendered.unmount();
  });

  it('retries a reload-surviving departing-owner purge before admitting the next owner', async () => {
    beginPortalCleanupQuarantine('departed-user');
    let finishDepartingOwnerDelete: (() => void) | null = null;
    deleteIndexedDbKeyMock.mockImplementation((key: unknown) => {
      if (key === 'sanctuary-portal-local-first:v2:departed-user') {
        return new Promise<void>((resolve) => { finishDepartingOwnerDelete = resolve; });
      }
      return Promise.resolve();
    });

    const rendered = renderIntoDocument(
      <PortalAuthProvider>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(fetchPortalRoleMock).not.toHaveBeenCalled();
    expect(deleteIndexedDbKeyMock).toHaveBeenCalledWith('sanctuary-portal-local-first:v2:departed-user');

    await act(async () => {
      finishDepartingOwnerDelete?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(probe.dataset.status).toBe('authenticated');
    expect(window.localStorage.getItem(portalCleanupQuarantineStorageKey)).toBeNull();
    rendered.unmount();
  });

  it('retains a failed entry quarantine and retries it before the same owner can mount', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let rejectLegacyCleanup = true;
    deleteIndexedDbKeyMock.mockImplementation((key: unknown) => {
      if (key === 'sanctuary-portal-local-first-v1' && rejectLegacyCleanup) {
        return Promise.reject(new Error('legacy indexeddb unavailable'));
      }
      return Promise.resolve();
    });
    const rendered = renderIntoDocument(
      <PortalAuthProvider>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('lookup_failed');
    expect(fetchPortalRoleMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(portalCleanupQuarantineStorageKey)).toBeTruthy();

    rejectLegacyCleanup = false;
    await act(async () => {
      authStateChangeCallback?.('TOKEN_REFRESHED', {
        user: { id: 'user_1', email: 'ops@example.com' },
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(probe.dataset.status).toBe('authenticated');
    expect(fetchPortalRoleMock).toHaveBeenCalledWith('user_1');
    expect(window.localStorage.getItem(portalCleanupQuarantineStorageKey)).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    rendered.unmount();
  });

  it('keeps cached role access locked when live verification and refresh are unavailable', async () => {
    fetchPortalRoleMock.mockRejectedValue(new TypeError('Failed to fetch'));
    refreshSessionMock.mockRejectedValue(new TypeError('Failed to fetch'));
    window.localStorage.setItem('sanctuary-portal:portal-role-cache:v1', JSON.stringify({
      userId: 'user_1',
      role: 'admin',
      verifiedAt: Date.now(),
    }));

    const rendered = renderIntoDocument(
      <PortalAuthProvider>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(probe.dataset.role).toBe('admin');
    rendered.unmount();
  });

  it('ignores an initial session read that finishes after a newer auth event', async () => {
    let resolveInitialSession: ((value: unknown) => void) | null = null;
    getSessionMock.mockReturnValue(new Promise((resolve) => {
      resolveInitialSession = resolve;
    }));
    const rendered = renderIntoDocument(
      <PortalAuthProvider>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      authStateChangeCallback?.('SIGNED_IN', {
        user: { id: 'user_2', email: 'new@example.com' },
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      resolveInitialSession?.({
        data: { session: { user: { id: 'user_1', email: 'ops@example.com' } } },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('authenticated');
    expect(probe.dataset.email).toBe('new@example.com');
    expect(fetchPortalRoleMock).not.toHaveBeenCalledWith('user_1');
    rendered.unmount();
  });

  it('ignores a manual refresh read that finishes after a newer auth event', async () => {
    let resolveRefreshSession: ((value: unknown) => void) | null = null;
    getSessionMock
      .mockResolvedValueOnce({
        data: { session: { user: { id: 'user_1', email: 'ops@example.com' } } },
      })
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveRefreshSession = resolve;
      }));
    const rendered = renderIntoDocument(
      <PortalAuthProvider>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      (rendered.container.querySelector('[data-action="refresh"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      authStateChangeCallback?.('SIGNED_IN', {
        user: { id: 'user_2', email: 'new@example.com' },
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      resolveRefreshSession?.({
        data: { session: { user: { id: 'user_1', email: 'ops@example.com' } } },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(probe.dataset.email).toBe('new@example.com');
    expect(replaceMock).toHaveBeenCalledWith('/staff/projects', '/dashboard');
    expect(fetchPortalRoleMock).not.toHaveBeenCalledWith('user_2');
    rendered.unmount();
  });

  it('purges queued work when destructive sign-out is confirmed', async () => {
    bindLocalFirstStoreOwner('user_1');
    await ensureLocalFirstStoreReady();
    await enqueueLocalFirstMutation({ entityKey: 'estimate:1', mutationKey: 'estimate.save', payload: { total: 1 } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      (rendered.container.querySelector('button') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(persisted.queue).toEqual([]);
    expect(persisted.workingCopies).toEqual({});
    expect(replaceMock).toHaveBeenCalledWith('/staff/login');
    rendered.unmount();
  });

  it('waits for owner drafts to hydrate before deciding whether sign-out needs confirmation', async () => {
    persisted.workingCopies['estimate:delayed'] = {
      entityKey: 'estimate:delayed',
      data: { total: 42 },
      updatedAt: '2026-08-06T00:00:00.000Z',
    };
    let finishHydration: (() => void) | null = null;
    __setLocalFirstStorageAdapterForTests({
      get: () => new Promise<LocalFirstPersistedState>((resolve) => {
        finishHydration = () => resolve(structuredClone(persisted));
      }),
      set: async (next) => { persisted = structuredClone(next); },
    });
    bindLocalFirstStoreOwner('user_1');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      (rendered.container.querySelector('[data-action="sign-out"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();

    await act(async () => {
      finishHydration?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(confirm).toHaveBeenCalledOnce();
    expect(signOutMock).toHaveBeenCalledOnce();
    expect(replaceMock).toHaveBeenCalledWith('/staff/login');
    rendered.unmount();
  });

  it('does not admit a replacement user while sign-out is still pending', async () => {
    let finishSignOut: (() => void) | null = null;
    signOutMock.mockReturnValueOnce(new Promise((resolve) => {
      finishSignOut = () => resolve({ error: null });
    }));
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      (rendered.container.querySelector('[data-action="sign-out"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      authStateChangeCallback?.('SIGNED_IN', {
        user: { id: 'user_2', email: 'new@example.com' },
      });
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(probe.dataset.email).toBe('');
    expect(fetchPortalRoleMock).not.toHaveBeenCalledWith('user_2');

    await act(async () => {
      finishSignOut?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(probe.dataset.status).toBe('unauthenticated');
    expect(replaceMock).toHaveBeenCalledWith('/staff/login');
    rendered.unmount();
  });

  it('locks and purges another tab when an owner-scoped sign-out boundary arrives', async () => {
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'sanctuary-portal:auth-boundary:v1',
        newValue: JSON.stringify({
          ownerId: 'user_1',
          reason: 'signed-out',
          sentAt: Date.now() - 60_000,
          sourceId: 'other-tab',
          token: 'remote-tab',
        }),
      }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(probe.dataset.email).toBe('');
    expect(deleteIndexedDbKeyMock).toHaveBeenCalledWith('sanctuary-portal-local-first:v2:user_1');
    expect(replaceMock).toHaveBeenCalledWith('/login?callbackUrl=%2Fstaff%2Fprojects');
    rendered.unmount();
  });

  it('hard-resets a remote role change without deleting the same owner\'s drafts', async () => {
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    deleteIndexedDbKeyMock.mockClear();

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'sanctuary-portal:auth-boundary:v1',
        newValue: JSON.stringify({
          ownerId: 'user_1',
          reason: 'role-changed',
          sentAt: Date.now(),
          sourceId: 'other-tab',
          token: 'remote-role-change',
        }),
      }));
      await Promise.resolve();
    });

    expect((rendered.container.querySelector('[data-status]') as HTMLElement).dataset.status).toBe('loading');
    expect(deleteIndexedDbKeyMock).not.toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    rendered.unmount();
  });

  it('stays signed in when queued work is not confirmed', async () => {
    bindLocalFirstStoreOwner('user_1');
    await ensureLocalFirstStoreReady();
    await enqueueLocalFirstMutation({ entityKey: 'estimate:1', mutationKey: 'estimate.save', payload: { total: 1 } });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      (rendered.container.querySelector('button') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(signOutMock).not.toHaveBeenCalled();
    expect(getLocalFirstStoreSnapshot().state.queue).toHaveLength(1);
    rendered.unmount();
  });

  it('does not sign out when another tab reports retained owner work and discard is declined', async () => {
    queryRetainedWorkMock.mockResolvedValueOnce('retained');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      (rendered.container.querySelector('[data-action="sign-out"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(queryRetainedWorkMock).toHaveBeenCalledWith('user_1');
    expect(confirm).toHaveBeenCalledOnce();
    expect(signOutMock).not.toHaveBeenCalled();
    expect((rendered.container.querySelector('[data-status]') as HTMLElement).dataset.status)
      .toBe('authenticated');
    rendered.unmount();
  });

  it('requires an explicit confirmation before discarding actively syncing work', async () => {
    bindLocalFirstStoreOwner('user_1');
    await ensureLocalFirstStoreReady();
    const item = await enqueueLocalFirstMutation({ entityKey: 'estimate:1', mutationKey: 'estimate.save', payload: { total: 1 } });
    await markLocalFirstQueueItemSyncing(item.id);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      (rendered.container.querySelector('button') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(persisted.queue).toEqual([]);
    expect(persisted.workingCopies).toEqual({});
    rendered.unmount();
  });

  it('does not let an in-flight role lookup restore access after sign-out', async () => {
    let resolveRole: ((role: 'admin') => void) | null = null;
    fetchPortalRoleMock.mockReturnValue(new Promise<'admin'>((resolve) => {
      resolveRole = resolve;
    }));
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchPortalRoleMock).toHaveBeenCalledWith('user_1');

    await act(async () => {
      (rendered.container.querySelector('button') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      resolveRole?.('admin');
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('unauthenticated');
    expect(probe.dataset.role).toBe('');
    rendered.unmount();
  });

  it('stays logged out and still calls Supabase when one browser cache cannot be cleared', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    deleteIndexedDbKeyMock.mockRejectedValueOnce(new Error('indexeddb unavailable'));

    await act(async () => {
      (rendered.container.querySelector('button') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(signOutMock).toHaveBeenCalledOnce();
    expect(probe.dataset.status).toBe('unauthenticated');
    expect(consoleError).toHaveBeenCalled();
    expect(window.localStorage.getItem(portalCleanupQuarantineStorageKey)).toContain('user_1');
    expect(document.cookie).toContain(`${portalCleanupQuarantineCookieName}=`);
    rendered.unmount();
  });

  it('keeps the current document hard-locked when no quarantine marker can survive reload', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((rendered.container.querySelector('[data-status]') as HTMLElement).dataset.status).toBe('authenticated');

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('localStorage blocked', 'SecurityError');
    });
    const originalCookie = Object.getOwnPropertyDescriptor(document, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: () => {
        throw new DOMException('cookies blocked', 'SecurityError');
      },
    });

    try {
      await act(async () => {
        (rendered.container.querySelector('[data-action="sign-out"]') as HTMLButtonElement).click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
      expect(signOutMock).toHaveBeenCalledOnce();
      expect(probe.dataset.status).toBe('loading');
      expect(replaceMock).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(portalCleanupQuarantineStorageKey)).toBeNull();
      expect(consoleError).toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
      if (originalCookie) Object.defineProperty(document, 'cookie', originalCookie);
      else Reflect.deleteProperty(document, 'cookie');
      rendered.unmount();
    }
  });

  it('hides the departing user immediately while a user-change purge finishes', async () => {
    let finishOwnerDelete: (() => void) | null = null;
    deleteIndexedDbKeyMock.mockImplementation((key: unknown) => {
      if (key === 'sanctuary-portal-local-first:v2:user_1') {
        return new Promise<void>((resolve) => { finishOwnerDelete = resolve; });
      }
      return Promise.resolve();
    });
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      authStateChangeCallback?.('SIGNED_IN', {
        user: { id: 'user_2', email: 'new@example.com' },
      });
      await Promise.resolve();
    });

    await act(async () => {
      authStateChangeCallback?.('TOKEN_REFRESHED', {
        user: { id: 'user_2', email: 'new@example.com' },
      });
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(probe.dataset.email).toBe('new@example.com');
    expect(window.localStorage.getItem(portalCleanupQuarantineStorageKey)).toContain('user_1');

    await act(async () => {
      finishOwnerDelete?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(probe.dataset.status).toBe('loading');
    expect(replaceMock).toHaveBeenCalledWith('/staff/projects', '/dashboard');
    expect(window.localStorage.getItem(portalCleanupQuarantineStorageKey)).toBeNull();
    expect(fetchPortalRoleMock).not.toHaveBeenCalledWith('user_2');
    rendered.unmount();
  });

  it('does not admit a replacement user after sign-out starts purging the old owner', async () => {
    let finishOwnerDelete: (() => void) | null = null;
    deleteIndexedDbKeyMock.mockImplementation((key: unknown) => {
      if (key === 'sanctuary-portal-local-first:v2:user_1') {
        return new Promise<void>((resolve) => { finishOwnerDelete = resolve; });
      }
      return Promise.resolve();
    });
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fetchPortalRoleMock.mockClear();

    await act(async () => {
      authStateChangeCallback?.('SIGNED_OUT', null);
      await Promise.resolve();
    });
    await act(async () => {
      authStateChangeCallback?.('SIGNED_IN', {
        user: { id: 'user_2', email: 'new@example.com' },
      });
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(probe.dataset.email).toBe('');
    expect(fetchPortalRoleMock).not.toHaveBeenCalledWith('user_2');

    await act(async () => {
      finishOwnerDelete?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(replaceMock).toHaveBeenCalledWith('/login?callbackUrl=%2Fstaff%2Fprojects');
    rendered.unmount();
  });

  it('uses a hard data boundary when a verified admin is downgraded to staff', async () => {
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fetchPortalRoleMock.mockResolvedValueOnce('staff');

    await act(async () => {
      authStateChangeCallback?.('TOKEN_REFRESHED', {
        user: { id: 'user_1', email: 'ops@example.com' },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(probe.dataset.role).toBe('staff');
    expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    rendered.unmount();
  });

  it('hides protected content and clears owner caches when verified access is lost', async () => {
    fetchPortalRoleMock.mockResolvedValue(null);
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('no_access');
    expect(deleteIndexedDbKeyMock).toHaveBeenCalledWith('sanctuary-portal-local-first:v2:user_1');
    rendered.unmount();
  });

  it('does not remount a verified owner while an access-loss purge is pending', async () => {
    let finishOwnerDelete: (() => void) | null = null;
    deleteIndexedDbKeyMock.mockImplementation((key: unknown) => {
      if (key === 'sanctuary-portal-local-first:v2:user_1') {
        return new Promise<void>((resolve) => { finishOwnerDelete = resolve; });
      }
      return Promise.resolve();
    });
    fetchPortalRoleMock
      .mockResolvedValueOnce('admin')
      .mockResolvedValueOnce(null)
      .mockResolvedValue('admin');
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      authStateChangeCallback?.('TOKEN_REFRESHED', {
        user: { id: 'user_1', email: 'ops@example.com' },
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      authStateChangeCallback?.('SIGNED_IN', {
        user: { id: 'user_1', email: 'ops@example.com' },
      });
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('loading');
    expect(fetchPortalRoleMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      finishOwnerDelete?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(probe.dataset.status).toBe('no_access');
    expect(replaceMock).toHaveBeenCalledWith('/access-status?state=no-access&callbackUrl=%2Fstaff%2Fprojects');
    rendered.unmount();
  });

  it('locks owner data and revalidates when a live portal API returns 401', async () => {
    const apiFetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', apiFetch);
    fetchPortalRoleMock
      .mockResolvedValueOnce('admin')
      .mockResolvedValueOnce(null);
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((rendered.container.querySelector('[data-status]') as HTMLElement).dataset.status).toBe('authenticated');

    await act(async () => {
      await window.fetch('/api/staff/v1/projects/index');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect((rendered.container.querySelector('[data-status]') as HTMLElement).dataset.status).toBe('no_access');
    expect(fetchPortalRoleMock).toHaveBeenCalledTimes(2);
    expect(deleteIndexedDbKeyMock).toHaveBeenCalledWith('sanctuary-portal-local-first:v2:user_1');
    rendered.unmount();
  });

  it('rechecks access when an idle authenticated tab regains focus', async () => {
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fetchPortalRoleMock.mockResolvedValueOnce(null);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect((rendered.container.querySelector('[data-status]') as HTMLElement).dataset.status).toBe('no_access');
    expect(deleteIndexedDbKeyMock).toHaveBeenCalledWith('sanctuary-portal-local-first:v2:user_1');
    rendered.unmount();
  });

  it('stays locally locked instead of navigating when Supabase cannot remove the session', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    signOutMock
      .mockResolvedValueOnce({ error: new Error('global logout unavailable') })
      .mockResolvedValueOnce({ error: new Error('local logout unavailable') });
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      (rendered.container.querySelector('[data-action="sign-out"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect((rendered.container.querySelector('[data-status]') as HTMLElement).dataset.status).toBe('loading');
    expect(stopAutoRefreshMock).toHaveBeenCalledOnce();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    rendered.unmount();
  });

  it('keeps access denied when an access-loss purge is only partially successful', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rendered = renderIntoDocument(
      <PortalAuthProvider initialAuthState={{ status: 'authenticated', user: { id: 'user_1', email: 'ops@example.com' }, role: 'admin' }}>
        <SessionProbe />
      </PortalAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    fetchPortalRoleMock.mockResolvedValueOnce(null);
    deleteIndexedDbKeyMock.mockRejectedValueOnce(new Error('indexeddb unavailable'));
    await act(async () => {
      authStateChangeCallback?.('TOKEN_REFRESHED', {
        user: { id: 'user_1', email: 'ops@example.com' },
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = rendered.container.querySelector('[data-status]') as HTMLElement;
    expect(probe.dataset.status).toBe('no_access');
    expect(consoleError).toHaveBeenCalled();
    expect(window.localStorage.getItem(portalCleanupQuarantineStorageKey)).toContain('user_1');
    rendered.unmount();
  });
});
