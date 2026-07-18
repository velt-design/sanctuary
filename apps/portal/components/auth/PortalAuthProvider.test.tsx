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

const replaceMock = vi.fn();
const fetchPortalRoleMock = vi.fn();
const getSessionMock = vi.fn();
const refreshSessionMock = vi.fn();
const signOutMock = vi.fn();
const onAuthStateChangeMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock('@/lib/queries/auth', () => ({
  fetchPortalRole: (...args: unknown[]) => fetchPortalRoleMock(...args),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  getSupabaseBrowser: () => ({
    auth: {
      getSession: () => getSessionMock(),
      refreshSession: () => refreshSessionMock(),
      signOut: () => signOutMock(),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
  }),
}));

function SessionProbe() {
  const session = usePortalSession();
  return (
    <div data-status={session.status} data-role={session.role ?? ''} data-email={session.email ?? ''}>
      <button type="button" onClick={() => void session.signOut('/staff/login')}>Sign out probe</button>
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
    onAuthStateChangeMock.mockReset();

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
    onAuthStateChangeMock.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
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
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('seeds auth state from the server snapshot instead of starting blank', async () => {
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
    expect(probe.dataset.status).toBe('authenticated');
    expect(probe.dataset.role).toBe('admin');
    expect(probe.dataset.email).toBe('ops@example.com');

    await act(async () => {
      await Promise.resolve();
    });

    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(fetchPortalRoleMock).toHaveBeenCalledWith('user_1');

    rendered.unmount();
  });

  it('keeps queued work for the same user when sign-out is confirmed', async () => {
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
    expect(persisted.queue).toHaveLength(1);
    expect(replaceMock).toHaveBeenCalledWith('/staff/login');
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
});
