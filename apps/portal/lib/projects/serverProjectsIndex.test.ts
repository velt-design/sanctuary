import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();

function createQuery(result: { data: any; error: any; count?: number | null }) {
  // PR-PG1 (2026-06-16): `.range()` is the new terminal call after PostgREST
  // gets `.order(...)`. The mock chain now resolves at `.range()`, not at
  // `.order()`. `count` defaults to `null` to match Supabase's
  // `count: 'exact'` response shape when caller didn't ask for a count.
  const resolved = Promise.resolve({ count: null, ...result });
  const query: any = {
    select: vi.fn(() => query),
    is: vi.fn(() => query),
    not: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => resolved),
    // Make the query itself thenable so callers that still await the
    // builder directly (without `.range()`) get the same result — keeps
    // the helper backwards-compatible for non-paginated tests.
    then: (onFulfilled: any, onRejected: any) => resolved.then(onFulfilled, onRejected),
  };
  return query;
}

describe('loadProjectsIndexData', () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
  });

  it('loads projects and contacts through an injected server client', async () => {
    fromMock.mockImplementation((table: string) => {
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

    const { loadProjectsIndexData } = await import('./serverProjectsIndex');
    // PR-PG1c (2026-06-16): return shape is now
    // `{ projects: ChunkedListFetchResult<Project>, contacts: ChunkedListFetchResult<Contact> }`
    // (each row gets a `truncated: boolean` from `fetchAllPages`).
    await expect(loadProjectsIndexData({ from: fromMock } as any)).resolves.toEqual({
      projects: {
        rows: [
          expect.objectContaining({
            id: 'proj_11111111-1111-4111-8111-111111111111',
            projectName: 'Deck Build',
            name: 'Deck Build',
            status: 'NEW',
            followUpDate: '2026-04-10',
          }),
        ],
        totalCount: null,
        truncated: false,
      },
      contacts: {
        rows: [
          {
            id: 'ct_22222222-2222-4222-8222-222222222222',
            displayName: 'Alex Contact',
            email: 'alex@example.com',
            phone: '021',
            createdAt: '2026-04-04T00:00:00.000Z',
            updatedAt: '2026-04-04T00:00:00.000Z',
          },
        ],
        totalCount: null,
        truncated: false,
      },
    });
  });

  it('queries archived-only projects when archiveFilter is "archived"', async () => {
    const projectsQuery = createQuery({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Archived Build',
          created_at: '2026-04-05T00:00:00.000Z',
          updated_at: '2026-04-06T00:00:00.000Z',
          pipeline_stage: 'NEW',
          archived_at: '2026-05-01T00:00:00.000Z',
        },
      ],
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'projects') return projectsQuery;
      if (table === 'contacts') return createQuery({ data: [], error: null });
      throw new Error(`Unexpected table ${table}`);
    });

    const { loadProjectsIndexData } = await import('./serverProjectsIndex');
    const result = await loadProjectsIndexData({ from: fromMock } as any, { archiveFilter: 'archived' });

    expect(projectsQuery.not).toHaveBeenCalledWith('archived_at', 'is', null);
    expect(projectsQuery.is).not.toHaveBeenCalled();
    // PR-PG1 (2026-06-16): return shape changed from `{ projects: Project[] }` to
    // `{ projects: { rows: Project[]; totalCount } }`.
    expect(result.projects.rows[0]?.isArchived).toBe(true);
  });

  it('drops the archived_at filter when archiveFilter is "all"', async () => {
    const projectsQuery = createQuery({ data: [], error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'projects') return projectsQuery;
      if (table === 'contacts') return createQuery({ data: [], error: null });
      throw new Error(`Unexpected table ${table}`);
    });

    const { loadProjectsIndexData } = await import('./serverProjectsIndex');
    await loadProjectsIndexData({ from: fromMock } as any, { archiveFilter: 'all' });

    expect(projectsQuery.is).not.toHaveBeenCalled();
    expect(projectsQuery.not).not.toHaveBeenCalled();
  });

  it('keeps the archived_at fallback query behavior unchanged', async () => {
    let projectCall = 0;

    fromMock.mockImplementation((table: string) => {
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

    const { loadProjectsIndexData } = await import('./serverProjectsIndex');
    const data = await loadProjectsIndexData({ from: fromMock } as any);

    expect(projectCall).toBe(2);
    // PR-PG1: shape is `{ rows, totalCount }` now.
    expect(data.projects.rows).toHaveLength(1);
  });
});
