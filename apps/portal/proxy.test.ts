import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const createServerClientMock = vi.fn();
const getUserMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

import { proxy } from './proxy';

const mockSupabase = {
  auth: {
    getUser: () => getUserMock(),
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => maybeSingleMock(),
      }),
    }),
  }),
};

function setAuthenticated(role: 'admin' | 'staff' = 'staff') {
  getUserMock.mockResolvedValue({
    data: { user: { id: 'user_1', email: 'ops@example.com' } },
    error: null,
  });
  maybeSingleMock.mockResolvedValue({
    data: { role },
    error: null,
  });
}

function setUnauthenticated() {
  getUserMock.mockResolvedValue({
    data: { user: null },
    error: null,
  });
  maybeSingleMock.mockResolvedValue({
    data: null,
    error: null,
  });
}

function setNoAccess() {
  getUserMock.mockResolvedValue({
    data: { user: { id: 'user_1', email: 'ops@example.com' } },
    error: null,
  });
  maybeSingleMock.mockResolvedValue({
    data: null,
    error: null,
  });
}

function setLookupFailed() {
  getUserMock.mockResolvedValue({
    data: { user: { id: 'user_1', email: 'ops@example.com' } },
    error: null,
  });
  maybeSingleMock.mockResolvedValue({
    data: null,
    error: { message: 'temporary failure' },
  });
}

describe('portal proxy', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    createServerClientMock.mockReset();
    getUserMock.mockReset();
    maybeSingleMock.mockReset();
    createServerClientMock.mockReturnValue(mockSupabase);
  });

  it.each([
    ['/dashboard', 'https://example.com/login?callbackUrl=%2Fdashboard'],
    ['/staff/projects', 'https://example.com/login?callbackUrl=%2Fstaff%2Fprojects'],
    ['/pricebook', 'https://example.com/login?callbackUrl=%2Fpricebook'],
    ['/admin/imports?tab=csv', 'https://example.com/login?callbackUrl=%2Fadmin%2Fimports%3Ftab%3Dcsv'],
  ])('redirects unauthenticated protected access for %s', async (path, expectedLocation) => {
    setUnauthenticated();

    const response = await proxy(new NextRequest(`https://example.com${path}`));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(expectedLocation);
  });

  it('preserves pathname and query string in callbackUrl', async () => {
    setUnauthenticated();

    const response = await proxy(new NextRequest('https://example.com/staff/projects?q=deck&status=all'));

    expect(response.headers.get('location')).toBe(
      'https://example.com/login?callbackUrl=%2Fstaff%2Fprojects%3Fq%3Ddeck%26status%3Dall',
    );
  });

  it('allows authenticated access to protected routes', async () => {
    setAuthenticated('admin');

    const response = await proxy(new NextRequest('https://example.com/dashboard'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('rewrites clean aliases into staff routes for authenticated users', async () => {
    setAuthenticated('staff');

    const response = await proxy(new NextRequest('https://example.com/projects'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://example.com/staff/projects');
  });

  it('rejects unsafe callback URLs on /login for authenticated users', async () => {
    setAuthenticated('staff');

    const response = await proxy(new NextRequest('https://example.com/login?callbackUrl=https://evil.example/phish'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/dashboard');
  });

  it('redirects authenticated login visits to the safe callback', async () => {
    setAuthenticated('staff');

    const response = await proxy(new NextRequest('https://example.com/login?callbackUrl=%2Fstaff%2Fcontacts'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/staff/contacts');
  });

  it('redirects missing-access users to the access-status page', async () => {
    setNoAccess();

    const response = await proxy(new NextRequest('https://example.com/staff/projects'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.com/access-status?state=no-access&callbackUrl=%2Fstaff%2Fprojects',
    );
  });

  it('redirects transient lookup failures to the retryable access-status page', async () => {
    setLookupFailed();

    const response = await proxy(new NextRequest('https://example.com/staff/projects'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.com/access-status?state=lookup-failed&callbackUrl=%2Fstaff%2Fprojects',
    );
  });

  it('redirects non-admin users away from admin routes', async () => {
    setAuthenticated('staff');

    const response = await proxy(new NextRequest('https://example.com/admin/imports'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/staff/calculator');
  });

  it('redirects non-admin users away from pricebook routes', async () => {
    setAuthenticated('staff');

    const response = await proxy(new NextRequest('https://example.com/pricebook#materials'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/staff/calculator#materials');
  });

  it('canonicalizes /staff/login to /login before auth handling', async () => {
    const response = await proxy(new NextRequest('https://example.com/staff/login?callbackUrl=%2Fstaff%2Fprojects'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/login?callbackUrl=%2Fstaff%2Fprojects');
  });
});
