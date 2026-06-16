import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();

function createQuery(result: { data: any; error: any; count?: number | null }) {
  // PR-PG1 (2026-06-16): `.range()` is the new terminal call after
  // `.order(...)`. Mock chain resolves at `.range()`. `count` defaults
  // to `null` to match Supabase's `count: 'exact'` response.
  //
  // PR-PG1c (2026-06-16): `fetchAllPages()` calls `.range(from, to)`
  // repeatedly until a short page is returned. The mock's single
  // resolved payload satisfies the first page; since `data.length` is
  // always less than the chunk size in these fixtures, the helper
  // exits after one call. If you need to test multi-page behavior,
  // see `apps/portal/lib/list/listLimits.test.ts:fetchAllPages`.
  const resolved = Promise.resolve({ count: null, ...result });
  const query: any = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => resolved),
    then: (onFulfilled: any, onRejected: any) => resolved.then(onFulfilled, onRejected),
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
    // PR-PG1c (2026-06-16): return shape is `{ rows, totalCount, truncated }`.
    await expect(loadContactsIndexData({ from: fromMock } as any)).resolves.toEqual({
      rows: [
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
      ],
      totalCount: null,
      truncated: false,
    });
  });

  it('throws on Supabase query failure', async () => {
    const error = new Error('contacts query failed');
    fromMock.mockImplementation((table: string) => {
      if (table !== 'contacts') throw new Error(`Unexpected table ${table}`);
      return createQuery({ data: null, error });
    });

    const { loadContactsIndexData } = await import('./serverContactsIndex');
    await expect(loadContactsIndexData({ from: fromMock } as any)).rejects.toBe(error);
  });
});
