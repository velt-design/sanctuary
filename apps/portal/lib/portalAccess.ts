import type { User } from '@supabase/supabase-js';
import type { PortalRole } from '@/lib/authTypes';

export type PortalAuthUser = {
  id: string;
  email: string | null;
};

export type PortalSessionSnapshot = {
  user: PortalAuthUser;
  role: PortalRole;
};

export type PortalAccessState =
  | { kind: 'authenticated'; session: PortalSessionSnapshot }
  | { kind: 'unauthenticated' }
  | { kind: 'no_access'; user: PortalAuthUser }
  | { kind: 'lookup_failed'; user: PortalAuthUser; message?: string };

export type AccessStatusQueryState = 'no-access' | 'lookup-failed';
export type PortalAuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'no_access' | 'lookup_failed';
export type PortalAuthInitialState = {
  status: PortalAuthStatus;
  user: PortalAuthUser | null;
  role: PortalRole | null;
};
type PortalAccessUserSource = Pick<User, 'id'> & {
  email?: string | null;
};

export type PortalAccessLookup = {
  auth: {
    getUser: () => Promise<{ data?: { user?: PortalAccessUserSource | null } | null; error?: { message?: string } | null }>;
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data?: { role?: string | null } | null; error?: { message?: string } | null }>;
      };
    };
  };
};

function toPortalRole(value: unknown): PortalRole | null {
  if (value === 'admin') return 'admin';
  if (value === 'staff') return 'staff';
  return null;
}

export function toPortalAuthUser(user: PortalAccessUserSource): PortalAuthUser {
  return {
    id: String(user.id),
    email: typeof user.email === 'string' ? user.email : null,
  };
}

export async function resolvePortalAccessState(supabase: PortalAccessLookup): Promise<PortalAccessState> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return { kind: 'unauthenticated' };
  }

  const user = toPortalAuthUser(userData.user);
  const { data: portalUser, error: portalError } = await supabase
    .from('portal_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (portalError) {
    return {
      kind: 'lookup_failed',
      user,
      message: typeof portalError.message === 'string' ? portalError.message : undefined,
    };
  }

  const role = toPortalRole(portalUser?.role);
  if (!role) {
    return { kind: 'no_access', user };
  }

  return {
    kind: 'authenticated',
    session: {
      user,
      role,
    },
  };
}

export function getSafeCallbackUrl(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//')) return fallback;
  return trimmed;
}

export function currentRequestPathWithSearch(url: URL): string {
  return `${url.pathname}${url.search}`;
}

export function toAccessStatusQueryState(kind: Extract<PortalAccessState['kind'], 'no_access' | 'lookup_failed'>): AccessStatusQueryState {
  return kind === 'no_access' ? 'no-access' : 'lookup-failed';
}

export function parseAccessStatusQueryState(raw: string | null | undefined): AccessStatusQueryState {
  return raw === 'no-access' ? 'no-access' : 'lookup-failed';
}

export function buildLoginHref(callbackUrl: string): string {
  const params = new URLSearchParams();
  params.set('callbackUrl', getSafeCallbackUrl(callbackUrl));
  return `/login?${params.toString()}`;
}

export function buildAccessStatusHref(input: {
  state: AccessStatusQueryState;
  callbackUrl?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('state', parseAccessStatusQueryState(input.state));

  const callbackUrl = getSafeCallbackUrl(input.callbackUrl, '');
  if (callbackUrl) {
    params.set('callbackUrl', callbackUrl);
  }

  return `/access-status?${params.toString()}`;
}

export function initialPortalAuthStateFromAccess(accessState: PortalAccessState): PortalAuthInitialState {
  if (accessState.kind === 'authenticated') {
    return {
      status: 'authenticated',
      user: accessState.session.user,
      role: accessState.session.role,
    };
  }

  if (accessState.kind === 'no_access') {
    return {
      status: 'no_access',
      user: accessState.user,
      role: null,
    };
  }

  if (accessState.kind === 'lookup_failed') {
    return {
      status: 'lookup_failed',
      user: accessState.user,
      role: null,
    };
  }

  return {
    status: 'unauthenticated',
    user: null,
    role: null,
  };
}
