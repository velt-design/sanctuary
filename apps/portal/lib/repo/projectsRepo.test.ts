import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSupabaseBrowser = vi.fn();

vi.mock('@/lib/supabase/browserClient', () => ({
  getSupabaseBrowser,
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
  supabaseHostFromUrl: () => 'example.supabase.co',
  supabaseRestUrl: (table: string) => `https://example.supabase.co/rest/v1/${table}`,
}));

function createListQuery(result: { data: any; error: any; count?: number | null }) {
  // PR-PG1 (2026-06-16): `.range()` is the new terminal call after `.order()`.
  // Both `.order().range()` and direct-await of the builder resolve to the
  // same payload (with `count: null` defaulted when not supplied).
  const resolved = Promise.resolve({ count: null, ...result });
  const query: any = {
    select: vi.fn(() => query),
    is: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => resolved),
    then(onFulfilled: any, onRejected: any) {
      return resolved.then(onFulfilled, onRejected);
    },
  };
  return query;
}

describe('projectsRepo schema guardrails', () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseBrowser.mockReset();
  });

  it('fails explicitly when projects.archived_at is missing instead of falling back', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table !== 'projects') throw new Error(`Unexpected table ${table}`);
      return createListQuery({
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'archived_at' column of 'projects' in the schema cache",
        },
      });
    });
    getSupabaseBrowser.mockReturnValue({ from: fromMock });

    const { listProjects } = await import('./projectsRepo');

    await expect(listProjects()).rejects.toThrow(/missing required column "archived_at"/i);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('fails explicitly on unknown write columns instead of retrying with columns removed', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST204',
        message: "Could not find the 'updated_at' column of 'projects' in the schema cache",
      },
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const fromMock = vi.fn((table: string) => {
      if (table !== 'projects') throw new Error(`Unexpected table ${table}`);
      return { insert: insertMock };
    });
    getSupabaseBrowser.mockReturnValue({ from: fromMock });

    const { createProject } = await import('./projectsRepo');

    await expect(
      createProject({
        contactId: 'ct_11111111-1111-4111-8111-111111111111',
        projectName: 'Pergola A',
      }),
    ).rejects.toThrow(/missing required column "updated_at"/i);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(singleMock).toHaveBeenCalledTimes(1);
  });
});
