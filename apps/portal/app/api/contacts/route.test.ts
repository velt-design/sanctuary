import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const fromMock = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffContext,
  };
});

describe('POST /api/contacts', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    fromMock.mockReset();
    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { email: 'ops@example.com' }, role: 'staff' },
      supabase: { from: (...args: unknown[]) => fromMock(...args) },
    });
  });

  it('returns 401 when no staff session exists', async () => {
    requireStaffContext.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/contacts'));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 on invalid JSON', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/contacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-request-id': 'req_contacts_create_invalid_json' },
        body: '{',
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON body' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_contacts_create_invalid_json');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });

  it('returns 400 when displayName is blank', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/contacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-request-id': 'req_contacts_create_blank' },
        body: JSON.stringify({ displayName: '   ', email: 'a@example.com' }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Contact name is required' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_contacts_create_blank');
  });

  it('fails explicitly on schema mismatch instead of retrying with columns removed', async () => {
    const insertPayloads: Array<Record<string, unknown>> = [];
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST204',
        message: "Could not find the 'updated_at' column of 'contacts' in the schema cache",
      },
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn((payload: Record<string, unknown>) => {
      insertPayloads.push({ ...payload });
      return { select: selectMock };
    });
    fromMock.mockImplementation((table: string) => {
      if (table !== 'contacts') throw new Error(`Unexpected table ${table}`);
      return { insert: insertMock };
    });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/contacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-request-id': 'req_contacts_create_schema' },
        body: JSON.stringify({ displayName: 'Alex Mason', email: 'alex@example.com', phone: '021' }),
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'Unsupported database schema for "contacts": missing required column "updated_at". Apply the current portal schema.',
    });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertPayloads[0]).toEqual(
      expect.objectContaining({
        name: 'Alex Mason',
        email: 'alex@example.com',
        phone: '021',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
    expect(res.headers.get('x-portal-request-id')).toBe('req_contacts_create_schema');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });
});
