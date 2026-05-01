import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: {
    from: fromMock,
  },
  supabaseServer: {
    from: fromMock,
  },
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  getSupabaseServerAuth: vi.fn(async () => ({
    from: fromMock,
  })),
}));

function createQuery(result: { data: any; error: any }) {
  const query: any = {
    select: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}

describe('loadContactsIndexData', () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
  });

  it('maps and sorts contacts into the same wire shape as the browser repo', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table !== 'contacts') throw new Error(`Unexpected table ${table}`);
      return createQuery({
        data: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            name: ' Zoe ',
            email: 'zoe@example.com',
            phone: '021',
            created_at: '2026-04-05T00:00:00.000Z',
            updated_at: '2026-04-05T00:00:00.000Z',
          },
          {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Alex',
            email: '',
            phone: '',
            created_at: '2026-04-04T00:00:00.000Z',
            updated_at: '2026-04-04T00:00:00.000Z',
          },
        ],
        error: null,
      });
    });

    const { loadContactsIndexData } = await import('./serverContactsIndex');
    await expect(loadContactsIndexData()).resolves.toEqual([
      {
        id: 'ct_11111111-1111-4111-8111-111111111111',
        displayName: 'Alex',
        email: '',
        phone: '',
        createdAt: '2026-04-04T00:00:00.000Z',
        updatedAt: '2026-04-04T00:00:00.000Z',
      },
      {
        id: 'ct_22222222-2222-4222-8222-222222222222',
        displayName: 'Zoe',
        email: 'zoe@example.com',
        phone: '021',
        createdAt: '2026-04-05T00:00:00.000Z',
        updatedAt: '2026-04-05T00:00:00.000Z',
      },
    ]);
  });

  it('throws on Supabase query failure', async () => {
    const error = new Error('contacts query failed');
    fromMock.mockImplementation((table: string) => {
      if (table !== 'contacts') throw new Error(`Unexpected table ${table}`);
      return createQuery({ data: null, error });
    });

    const { loadContactsIndexData } = await import('./serverContactsIndex');
    await expect(loadContactsIndexData()).rejects.toBe(error);
  });
});
