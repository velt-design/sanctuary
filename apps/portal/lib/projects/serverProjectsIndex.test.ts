import { describe, expect, it, vi } from 'vitest';
import { loadProjectsIndexData, ProjectsIndexSchemaError } from './serverProjectsIndex';

const params = {
  archive: 'active',
  search: 'deck',
  status: 'NEW',
  due: 'all',
  today: '2026-07-29',
  page: 1,
  pageSize: 50,
  sort: 'newest',
} as const;

describe('loadProjectsIndexData', () => {
  it('maps one bounded project page and only its linked contacts', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        rows: [{
          id: '11111111-1111-4111-8111-111111111111',
          contact_id: '22222222-2222-4222-8222-222222222222',
          name: 'Deck Build',
          created_at: '2026-04-05T00:00:00.000Z',
          updated_at: '2026-04-06T00:00:00.000Z',
          pipeline_stage: 'NEW',
          archived_at: null,
          follow_up_date: '2026-04-10',
          contact_name: 'Alex Contact',
          contact_email: 'alex@example.com',
          contact_phone: '021',
          contact_created_at: '2026-04-04T00:00:00.000Z',
          contact_updated_at: '2026-04-04T00:00:00.000Z',
        }],
        totalCount: 81,
        page: 1,
        pageSize: 50,
      },
      error: null,
    });

    const result = await loadProjectsIndexData(params, { rpc } as any);
    expect(result.projects).toEqual({
      rows: [expect.objectContaining({
        id: 'proj_11111111-1111-4111-8111-111111111111',
        projectName: 'Deck Build',
        status: 'NEW',
      })],
      totalCount: 81,
      truncated: false,
      page: 1,
      pageSize: 50,
      totalPages: 2,
    });
    expect(result.contacts.rows).toEqual([expect.objectContaining({
      id: 'ct_22222222-2222-4222-8222-222222222222',
      displayName: 'Alex Contact',
    })]);
    expect(rpc).toHaveBeenCalledWith('staff_projects_index_v1', {
      p_archive: 'active',
      p_search: 'deck',
      p_status: 'NEW',
      p_due: 'all',
      p_today: '2026-07-29',
      p_page: 1,
      p_page_size: 50,
      p_sort: 'newest',
    });
  });

  it('reports a missing rollout function as an explicit schema gate', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42883', message: 'function missing' } });
    await expect(loadProjectsIndexData(params, { rpc } as any)).rejects.toBeInstanceOf(ProjectsIndexSchemaError);
  });
});
