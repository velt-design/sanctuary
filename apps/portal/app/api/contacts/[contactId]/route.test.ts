import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const fromMock = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffSession,
  };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

describe('PATCH /api/contacts/[contactId]', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    fromMock.mockReset();
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
  });

  it('returns 401 when no staff session exists', async () => {
    requireStaffSession.mockResolvedValue(null);

    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request('http://localhost/api/contacts/ct_1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: 'Alex' }),
      }),
      { params: Promise.resolve({ contactId: 'ct_1' }) },
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 for invalid contact input', async () => {
    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request('http://localhost/api/contacts/ct_11111111-1111-4111-8111-111111111111', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-request-id': 'req_contacts_patch_blank' },
        body: JSON.stringify({ displayName: '  ' }),
      }),
      { params: Promise.resolve({ contactId: 'ct_11111111-1111-4111-8111-111111111111' }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Contact name is required' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_contacts_patch_blank');
  });

  it('returns 404 when the contact is not found', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Contact not found' },
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    fromMock.mockImplementation((table: string) => {
      if (table !== 'contacts') throw new Error(`Unexpected table ${table}`);
      return { update: updateMock };
    });

    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request('http://localhost/api/contacts/ct_11111111-1111-4111-8111-111111111111', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-request-id': 'req_contacts_patch_404' },
        body: JSON.stringify({ email: 'alex@example.com' }),
      }),
      { params: Promise.resolve({ contactId: 'ct_11111111-1111-4111-8111-111111111111' }) },
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Contact not found' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_contacts_patch_404');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });

  it('returns the updated contact with diagnostics headers on success', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Alex Mason',
        email: 'alex@example.com',
        phone: '021',
        created_at: '2026-04-07T00:00:00.000Z',
        updated_at: '2026-04-08T00:00:00.000Z',
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    fromMock.mockImplementation((table: string) => {
      if (table !== 'contacts') throw new Error(`Unexpected table ${table}`);
      return { update: updateMock };
    });

    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request('http://localhost/api/contacts/ct_11111111-1111-4111-8111-111111111111', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-request-id': 'req_contacts_patch_ok' },
        body: JSON.stringify({ email: 'alex@example.com' }),
      }),
      { params: Promise.resolve({ contactId: 'ct_11111111-1111-4111-8111-111111111111' }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      contact: {
        id: 'ct_11111111-1111-4111-8111-111111111111',
        displayName: 'Alex Mason',
        email: 'alex@example.com',
        phone: '021',
        createdAt: '2026-04-07T00:00:00.000Z',
        updatedAt: '2026-04-08T00:00:00.000Z',
      },
    });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'alex@example.com',
        updated_at: expect.any(String),
      }),
    );
    expect(res.headers.get('x-portal-request-id')).toBe('req_contacts_patch_ok');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });

  it('fails explicitly on schema mismatch instead of retrying with columns removed', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST204',
        message: "Could not find the 'updated_at' column of 'contacts' in the schema cache",
      },
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    fromMock.mockImplementation((table: string) => {
      if (table !== 'contacts') throw new Error(`Unexpected table ${table}`);
      return { update: updateMock };
    });

    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request('http://localhost/api/contacts/ct_11111111-1111-4111-8111-111111111111', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-request-id': 'req_contacts_patch_schema' },
        body: JSON.stringify({ email: 'alex@example.com' }),
      }),
      { params: Promise.resolve({ contactId: 'ct_11111111-1111-4111-8111-111111111111' }) },
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'Unsupported database schema for "contacts": missing required column "updated_at". Apply the current portal schema.',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_contacts_patch_schema');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });
});
