import { describe, expect, it, vi } from 'vitest';
import { loadContactsIndexData, ContactsIndexSchemaError } from './serverContactsIndex';

const params = { search: 'alex', page: 2, pageSize: 25, sort: 'name_asc' } as const;

describe('loadContactsIndexData', () => {
  it('maps one bounded RPC page into the browser contact contract', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        rows: [{
          id: '11111111-1111-4111-8111-111111111111',
          name: ' Alex ',
          email: 'alex@example.com',
          phone: '021',
          created_at: '2026-04-04T00:00:00.000Z',
          updated_at: '2026-04-05T00:00:00.000Z',
        }],
        totalCount: 61,
        page: 2,
        pageSize: 25,
      },
      error: null,
    });

    await expect(loadContactsIndexData(params, { rpc } as any)).resolves.toEqual({
      rows: [{
        id: 'ct_11111111-1111-4111-8111-111111111111',
        displayName: 'Alex',
        email: 'alex@example.com',
        phone: '021',
        createdAt: '2026-04-04T00:00:00.000Z',
        updatedAt: '2026-04-05T00:00:00.000Z',
      }],
      totalCount: 61,
      truncated: false,
      page: 2,
      pageSize: 25,
      totalPages: 3,
    });
    expect(rpc).toHaveBeenCalledWith('staff_contacts_index_v1', {
      p_search: 'alex',
      p_page: 2,
      p_page_size: 25,
      p_sort: 'name_asc',
    });
  });

  it('reports a missing rollout function as an explicit schema gate', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function missing' } });
    await expect(loadContactsIndexData(params, { rpc } as any)).rejects.toBeInstanceOf(ContactsIndexSchemaError);
  });
});
