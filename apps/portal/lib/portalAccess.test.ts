import { describe, expect, it } from 'vitest';
import {
  buildAccessStatusHref,
  buildLoginHref,
  getSafeCallbackUrl,
  resolvePortalAccessState,
} from './portalAccess';

function createLookup({
  user,
  portalUser,
  portalError,
  userError,
}: {
  user?: { id: string; email: string | null } | null;
  portalUser?: { role?: string | null } | null;
  portalError?: { message?: string } | null;
  userError?: { message?: string } | null;
}) {
  return {
    auth: {
      async getUser() {
        return {
          data: { user: user ?? null },
          error: userError ?? null,
        };
      },
    },
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: portalUser ?? null,
                    error: portalError ?? null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe('portal access resolution', () => {
  it('returns authenticated when a portal role exists', async () => {
    const result = await resolvePortalAccessState(
      createLookup({
        user: { id: 'user_1', email: 'ops@example.com' },
        portalUser: { role: 'admin' },
      }),
    );

    expect(result).toEqual({
      kind: 'authenticated',
      session: {
        user: { id: 'user_1', email: 'ops@example.com' },
        role: 'admin',
      },
    });
  });

  it('returns unauthenticated when Supabase has no user', async () => {
    const result = await resolvePortalAccessState(
      createLookup({
        user: null,
      }),
    );

    expect(result).toEqual({ kind: 'unauthenticated' });
  });

  it('returns no_access when the portal user row is missing', async () => {
    const result = await resolvePortalAccessState(
      createLookup({
        user: { id: 'user_2', email: 'staff@example.com' },
        portalUser: null,
      }),
    );

    expect(result).toEqual({
      kind: 'no_access',
      user: { id: 'user_2', email: 'staff@example.com' },
    });
  });

  it('returns lookup_failed when the portal role lookup errors', async () => {
    const result = await resolvePortalAccessState(
      createLookup({
        user: { id: 'user_3', email: 'staff@example.com' },
        portalError: { message: 'database unavailable' },
      }),
    );

    expect(result).toEqual({
      kind: 'lookup_failed',
      user: { id: 'user_3', email: 'staff@example.com' },
      message: 'database unavailable',
    });
  });
});

describe('portal access helpers', () => {
  it('rejects unsafe callback URLs', () => {
    expect(getSafeCallbackUrl('https://evil.example/phish')).toBe('/dashboard');
    expect(getSafeCallbackUrl('//evil.example/phish')).toBe('/dashboard');
    expect(getSafeCallbackUrl('/staff/projects?q=deck')).toBe('/staff/projects?q=deck');
  });

  it('builds login and access-status links with safe callbacks', () => {
    expect(buildLoginHref('/staff/projects?q=deck')).toBe('/login?callbackUrl=%2Fstaff%2Fprojects%3Fq%3Ddeck');
    expect(
      buildAccessStatusHref({
        state: 'lookup-failed',
        callbackUrl: 'https://evil.example/phish',
      }),
    ).toBe('/access-status?state=lookup-failed');
  });
});
