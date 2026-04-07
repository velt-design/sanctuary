import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PORTAL_DEFAULT_ACCENT_HEX } from '@/lib/theme/presets';

const getSupabaseBrowser = vi.fn();

vi.mock('@/lib/supabase/browserClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/browserClient')>('@/lib/supabase/browserClient');
  return {
    ...actual,
    getSupabaseBrowser,
  };
});

type QueryResult = { data: any; error: any };

function createQuery(result: QueryResult) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    single: vi.fn(async () => result),
    then(onFulfilled: any, onRejected: any) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return query;
}

describe('installersRepo', () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseBrowser.mockReset();
  });

  it('returns mapped crews and filters active installers without performing writes', async () => {
    const rows = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Jayden',
        color: '#123456',
        is_active: true,
        calendar_region: 'Auckland',
        base_available_date: '2026-04-10',
        sort_order: 2,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'David',
        color: '',
        is_active: false,
        calendar_region: null,
        base_available_date: null,
        sort_order: 1,
      },
    ];

    const insertMock = vi.fn();
    const updateMock = vi.fn();
    const fromMock = vi.fn((table: string) => {
      if (table !== 'schedule_crews') throw new Error(`Unexpected table ${table}`);
      const query = createQuery({ data: rows, error: null });
      return {
        ...query,
        insert: insertMock,
        update: updateMock,
      };
    });

    getSupabaseBrowser.mockReturnValue({ from: fromMock });

    const { listInstallers } = await import('./installersRepo');
    const installers = await listInstallers();
    const activeOnly = await listInstallers({ activeOnly: true });

    expect(installers).toEqual([
      {
        id: 'crew_22222222-2222-4222-8222-222222222222',
        name: 'David',
        color: PORTAL_DEFAULT_ACCENT_HEX,
        active: false,
        calendarRegion: null,
        baseAvailableDate: null,
        sortOrder: 1,
      },
      {
        id: 'crew_11111111-1111-4111-8111-111111111111',
        name: 'Jayden',
        color: '#123456',
        active: true,
        calendarRegion: 'Auckland',
        baseAvailableDate: '2026-04-10',
        sortOrder: 2,
      },
    ]);
    expect(activeOnly).toEqual([
      {
        id: 'crew_11111111-1111-4111-8111-111111111111',
        name: 'Jayden',
        color: '#123456',
        active: true,
        calendarRegion: 'Auckland',
        baseAvailableDate: '2026-04-10',
        sortOrder: 2,
      },
    ]);
    expect(insertMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns an empty list instead of seeding or renaming crews during read', async () => {
    const insertMock = vi.fn();
    const updateMock = vi.fn();
    const fromMock = vi.fn((table: string) => {
      if (table !== 'schedule_crews') throw new Error(`Unexpected table ${table}`);
      const query = createQuery({ data: [], error: null });
      return {
        ...query,
        insert: insertMock,
        update: updateMock,
      };
    });

    getSupabaseBrowser.mockReturnValue({ from: fromMock });

    const { listInstallers } = await import('./installersRepo');
    await expect(listInstallers()).resolves.toEqual([]);
    expect(insertMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
