import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSupabaseServerAuthMock = vi.fn();

vi.mock('@/lib/supabase/serverClient', () => ({
  getSupabaseServerAuth: (...args: unknown[]) => getSupabaseServerAuthMock(...args),
}));

function createQuery(result: { data: any; error: any }) {
  const query: any = {
    select: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}

describe('loadProjectsIndexData', () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseServerAuthMock.mockReset();
  });

  it('loads projects and contacts through the server-auth client', async () => {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'projects') {
        return createQuery({
          data: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              name: 'Deck Build',
              created_at: '2026-04-05T00:00:00.000Z',
              updated_at: '2026-04-06T00:00:00.000Z',
              pipeline_stage: 'NEW',
              archived_at: null,
              follow_up_date: '2026-04-10',
            },
          ],
          error: null,
        });
      }

      if (table === 'contacts') {
        return createQuery({
          data: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              name: 'Alex Contact',
              email: 'alex@example.com',
              phone: '021',
              created_at: '2026-04-04T00:00:00.000Z',
              updated_at: '2026-04-04T00:00:00.000Z',
            },
          ],
          error: null,
        });
      }

      throw new Error(`Unexpected table ${table}`);
    });
    getSupabaseServerAuthMock.mockResolvedValue({ from: fromMock });

    const { loadProjectsIndexData } = await import('./serverProjectsIndex');
    await expect(loadProjectsIndexData()).resolves.toEqual({
      projects: [
        expect.objectContaining({
          id: 'proj_11111111-1111-4111-8111-111111111111',
          projectName: 'Deck Build',
          name: 'Deck Build',
          status: 'NEW',
          followUpDate: '2026-04-10',
        }),
      ],
      contacts: [
        {
          id: 'ct_22222222-2222-4222-8222-222222222222',
          displayName: 'Alex Contact',
          email: 'alex@example.com',
          phone: '021',
          createdAt: '2026-04-04T00:00:00.000Z',
          updatedAt: '2026-04-04T00:00:00.000Z',
        },
      ],
    });
    expect(getSupabaseServerAuthMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the archived_at fallback query behavior unchanged', async () => {
    let projectCall = 0;

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'projects') {
        projectCall += 1;
        if (projectCall === 1) {
          return createQuery({
            data: null,
            error: { code: 'PGRST204', message: "Could not find the 'archived_at' column of 'projects' in the schema cache" },
          });
        }
        return createQuery({
          data: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              name: 'Deck Build',
              created_at: '2026-04-05T00:00:00.000Z',
              updated_at: '2026-04-06T00:00:00.000Z',
              pipeline_stage: 'NEW',
            },
          ],
          error: null,
        });
      }

      if (table === 'contacts') {
        return createQuery({ data: [], error: null });
      }

      throw new Error(`Unexpected table ${table}`);
    });
    getSupabaseServerAuthMock.mockResolvedValue({ from: fromMock });

    const { loadProjectsIndexData } = await import('./serverProjectsIndex');
    const data = await loadProjectsIndexData();

    expect(projectCall).toBe(2);
    expect(data.projects).toHaveLength(1);
  });
});
