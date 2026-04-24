import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSupabaseBrowser = vi.fn();

vi.mock('@/lib/supabase/browserClient', () => ({
  getSupabaseBrowser,
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
  supabaseHostFromUrl: () => 'example.supabase.co',
  supabaseRestUrl: (table: string) => `https://example.supabase.co/rest/v1/${table}`,
}));

function createListQuery(result: { data: any; error: any }) {
  const query: any = {
    select: vi.fn(() => query),
    is: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve(result)),
    then(onFulfilled: any, onRejected: any) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
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
