import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const createServerClientMock = vi.fn();
const getUserMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

import { proxy } from './proxy';

const originalEnableFixtureFlag = process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES;
const originalPortalQaFixtureFlag = process.env.ENABLE_PORTAL_QA_FIXTURES;

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
    delete process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES;
    delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    createServerClientMock.mockReset();
    getUserMock.mockReset();
    maybeSingleMock.mockReset();
    createServerClientMock.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    if (originalEnableFixtureFlag === undefined) {
      delete process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES;
    } else {
      process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES = originalEnableFixtureFlag;
    }
    if (originalPortalQaFixtureFlag === undefined) {
      delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    } else {
      process.env.ENABLE_PORTAL_QA_FIXTURES = originalPortalQaFixtureFlag;
    }
  });

  it.each([
    ['/dashboard', 'https://example.com/login?callbackUrl=%2Fdashboard'],
    ['/staff/projects', 'https://example.com/login?callbackUrl=%2Fstaff%2Fprojects'],
    ['/staff/design-booklets', 'https://example.com/login?callbackUrl=%2Fstaff%2Fdesign-booklets'],
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

  it('allows a signed-out one-time auth callback to reach its route handler', async () => {
    setUnauthenticated();

    const response = await proxy(
      new NextRequest(
        'https://example.com/login/callback?token_hash=one-time-secret&callbackUrl=%2Fstaff%2Fprojects',
      ),
    );

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
  });

  it('allows authenticated access to protected routes', async () => {
    setAuthenticated('admin');

    const response = await proxy(new NextRequest('https://example.com/dashboard'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('rewrites enabled fixture workbench smoke routes before staff auth', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES = '1';

    const response = await proxy(new NextRequest('https://example.com/staff/projects/fixture-roof/design-workbench?fixture=mono-standard'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/qa/design-workbench-fixture?fixture=mono-standard',
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('allows the data-free project mutation fixture to enforce its own server flag without auth', async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';

    const response = await proxy(new NextRequest('https://example.com/qa/projects-index-mutation-fixture'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('allows project command centre fixture scenarios to enforce their own server flag without auth', async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';

    const response = await proxy(
      new NextRequest('https://example.com/qa/project-command-centre-fixture?scenario=accepted-newer-estimate'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('allows the commercial workflow fixture to enforce its own server flag without auth', async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';

    const response = await proxy(
      new NextRequest(
        'https://example.com/qa/commercial-workflow-fixture?scenario=retryable&modal=1',
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('allows the project page shell fixture to enforce its own server flag without auth', async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';

    const response = await proxy(new NextRequest('https://example.com/qa/project-page-shell-fixture?tab=activity'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('allows the UI foundation fixture to enforce its own server flag without auth', async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';

    const response = await proxy(new NextRequest('https://example.com/qa/ui-foundation-fixture'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('allows the email preview workbench fixture to enforce its own server flag without auth', async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';

    const response = await proxy(
      new NextRequest(
        'https://example.com/qa/email-preview-workbench-fixture',
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('allows the design booklet workbench fixture to enforce its own server flag without auth', async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';

    const response = await proxy(
      new NextRequest(
        'https://example.com/qa/design-booklet-workbench-fixture',
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('allows the project work queue fixture to enforce its own server flag without auth', async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';

    const response = await proxy(
      new NextRequest('https://example.com/qa/project-work-queue-fixture'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('keeps the staff fixture workbench route protected when fixture flags are disabled', async () => {
    setUnauthenticated();

    const response = await proxy(new NextRequest('https://example.com/staff/projects/fixture-roof/design-workbench?fixture=mono-standard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.com/login?callbackUrl=%2Fstaff%2Fprojects%2Ffixture-roof%2Fdesign-workbench%3Ffixture%3Dmono-standard',
    );
  });

  it('keeps non-fixture staff workbench routes protected', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES = '1';
    setUnauthenticated();

    const response = await proxy(new NextRequest('https://example.com/staff/projects/fixture-roof/design-workbench'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.com/login?callbackUrl=%2Fstaff%2Fprojects%2Ffixture-roof%2Fdesign-workbench',
    );
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
