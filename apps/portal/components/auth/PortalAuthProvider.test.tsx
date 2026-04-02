import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalAuthProvider, { usePortalSession } from './PortalAuthProvider';
import { renderIntoDocument } from '../../../../test/reactHarness';

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
    <div
      data-status={session.status}
      data-role={session.role ?? ''}
      data-email={session.email ?? ''}
    />
  );
}

describe('PortalAuthProvider', () => {
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
  });

  afterEach(() => {
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
});
