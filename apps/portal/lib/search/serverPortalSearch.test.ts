import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const responses = new Map<string, Row[]>();
const calls: Array<{ table: string; kind: 'ilike' | 'in'; column: string; value: unknown }> = [];

function queryFor(table: string) {
  let filter: { kind: 'ilike' | 'in'; column: string; value: unknown } | null = null;
  const query: any = {
    select: vi.fn(() => query),
    ilike: vi.fn((column: string, value: string) => {
      filter = { kind: 'ilike', column, value };
      return query;
    }),
    in: vi.fn((column: string, value: string[]) => {
      filter = { kind: 'in', column, value };
      return query;
    }),
    limit: vi.fn(async () => {
      if (!filter) throw new Error('Expected a filter before limit');
      calls.push({ table, ...filter });
      const key = `${table}:${filter.kind}:${filter.column}`;
      return { data: responses.get(key) ?? [], error: null };
    }),
  };
  return query;
}

describe('searchPortal', () => {
  beforeEach(() => {
    responses.clear();
    calls.length = 0;
  });

  it('groups, ranks and de-duplicates bounded project and contact matches', async () => {
    const contactAlex = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Alex Mason',
      email: 'alex@example.com',
      phone: '021 555 0101',
      address: 'Auckland',
    };
    const contactOther = {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Mason Group',
      email: 'alex.ops@example.com',
      phone: '021 555 0102',
      address: 'Hamilton',
    };
    const projectDirect = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Alex Deck',
      quote_ref: 'Q-1010',
      site_address: '1 Harbour Road',
      pipeline_stage: 'QUOTING',
      archived_at: null,
      contact: { id: contactAlex.id, name: contactAlex.name },
    };
    const projectLinked = {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Courtyard Canopy',
      quote_ref: null,
      site_address: '22 Albert Street',
      pipeline_stage: 'SITE VISIT',
      archived_at: null,
      contact: { id: contactAlex.id, name: contactAlex.name },
    };

    responses.set('projects:ilike:name', [projectDirect]);
    responses.set('projects:ilike:site_address', [projectDirect]);
    responses.set('contacts:ilike:name', [contactAlex]);
    responses.set('contacts:ilike:email', [contactAlex, contactOther]);
    responses.set('projects:in:contact_id', [projectLinked]);

    const client = { from: vi.fn((table: string) => queryFor(table)) } as any;
    const { searchPortal } = await import('./serverPortalSearch');
    const result = await searchPortal(client, 'alex');

    expect(result.projects).toEqual([
      expect.objectContaining({ name: 'Alex Deck', stage: 'quoting', kind: 'project' }),
      expect.objectContaining({ name: 'Courtyard Canopy', contactName: 'Alex Mason', stage: 'site_visit' }),
    ]);
    expect(result.contacts).toEqual([
      expect.objectContaining({ name: 'Alex Mason', kind: 'contact' }),
      expect.objectContaining({ name: 'Mason Group', email: 'alex.ops@example.com' }),
    ]);
    expect(result.projects[0]?.href).toContain('/staff/projects/proj_');
    expect(result.contacts[0]?.href).toContain('/staff/contacts/ct_');
    expect(calls.filter((call) => call.table === 'projects' && call.column === 'contact_id')).toHaveLength(1);
  });

  it('escapes wildcard characters before they reach PostgREST ilike filters', async () => {
    const client = { from: vi.fn((table: string) => queryFor(table)) } as any;
    const { escapePortalSearchPattern, searchPortal } = await import('./serverPortalSearch');
    expect(escapePortalSearchPattern('50%_off\\today')).toBe('50\\%\\_off\\\\today');

    await searchPortal(client, '50%_off');
    expect(calls.filter((call) => call.kind === 'ilike').every((call) => call.value === '%50\\%\\_off%')).toBe(true);
  });
});

