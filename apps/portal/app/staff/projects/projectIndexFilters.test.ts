import { describe, expect, it } from 'vitest';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { buildContactsById, filterProjectsForIndex, normalizePhone, parseProjectsIndexFilters, todayYmd } from './projectIndexFilters';

const contacts: Contact[] = [
  {
    id: 'ct_1',
    displayName: 'Alex Mason',
    email: 'alex@example.com',
    phone: '',
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
  },
];

const projects: Project[] = [
  {
    id: 'proj_1',
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
    contactId: 'ct_1',
    projectName: 'Beach Deck',
    region: 'North',
    quoteRef: 'QU-1',
    status: 'SENT',
    nextActionDate: '2026-04-03',
  },
  {
    id: 'proj_2',
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
    projectName: 'Pergola',
    region: 'South',
    status: 'NEW',
    nextActionDate: '2026-04-10',
  },
];

describe('projectIndexFilters', () => {
  it('parses q, status, due, and nextActionDue search params', () => {
    expect(parseProjectsIndexFilters(new URLSearchParams('q=deck&status=sent&due=today'))).toEqual({
      query: 'deck',
      statusFilter: 'SENT',
      dueFilter: 'today',
      archiveFilter: 'active',
    });

    expect(parseProjectsIndexFilters(new URLSearchParams('nextActionDue=1'))).toEqual({
      query: '',
      statusFilter: 'all',
      dueFilter: 'due',
      archiveFilter: 'active',
    });
  });

  it('parses the archive filter', () => {
    expect(parseProjectsIndexFilters(new URLSearchParams('archive=archived')).archiveFilter).toBe('archived');
    expect(parseProjectsIndexFilters(new URLSearchParams('archive=all')).archiveFilter).toBe('all');
    expect(parseProjectsIndexFilters(new URLSearchParams()).archiveFilter).toBe('active');
    expect(parseProjectsIndexFilters(new URLSearchParams('archive=bogus')).archiveFilter).toBe('active');
  });

  it('filters projects using the same rules as the projects index', () => {
    const contactsById = buildContactsById(contacts);

    expect(
      filterProjectsForIndex(
        projects,
        contactsById,
        {
          query: 'alex',
          statusFilter: 'SENT',
          dueFilter: 'today',
          archiveFilter: 'active',
        },
        '2026-04-03',
      ).map((project) => project.id),
    ).toEqual(['proj_1']);
  });

  it('matches phone numbers via formatted and digits-only forms', () => {
    const phoneContact = {
      id: 'ct_phone',
      displayName: 'Phone Person',
      email: '',
      phone: '021 123 4567',
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
    };
    const phoneProject = {
      id: 'proj_phone',
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
      contactId: 'ct_phone',
      projectName: 'Phone Job',
      status: 'NEW' as const,
    };
    const contactsById = buildContactsById([phoneContact]);

    expect(
      filterProjectsForIndex(
        [phoneProject],
        contactsById,
        { query: '0211234567', statusFilter: 'all', dueFilter: 'all', archiveFilter: 'active' },
        '2026-04-03',
      ),
    ).toHaveLength(1);

    expect(
      filterProjectsForIndex(
        [phoneProject],
        contactsById,
        { query: '021 123', statusFilter: 'all', dueFilter: 'all', archiveFilter: 'active' },
        '2026-04-03',
      ),
    ).toHaveLength(1);
  });

  it('respects archive filter when projecting visible rows', () => {
    const archived = {
      id: 'proj_archived',
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
      projectName: 'Archived Job',
      status: 'NEW' as const,
      isArchived: true,
    };
    const active = {
      id: 'proj_active',
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
      projectName: 'Active Job',
      status: 'NEW' as const,
      isArchived: false,
    };
    const contactsById = new Map();

    expect(
      filterProjectsForIndex(
        [archived, active],
        contactsById,
        { query: '', statusFilter: 'all', dueFilter: 'all', archiveFilter: 'active' },
        '2026-04-03',
      ).map((p) => p.id),
    ).toEqual(['proj_active']);

    expect(
      filterProjectsForIndex(
        [archived, active],
        contactsById,
        { query: '', statusFilter: 'all', dueFilter: 'all', archiveFilter: 'archived' },
        '2026-04-03',
      ).map((p) => p.id),
    ).toEqual(['proj_archived']);

    expect(
      filterProjectsForIndex(
        [archived, active],
        contactsById,
        { query: '', statusFilter: 'all', dueFilter: 'all', archiveFilter: 'all' },
        '2026-04-03',
      )
        .map((p) => p.id)
        .sort(),
    ).toEqual(['proj_active', 'proj_archived']);
  });

  it('normalizes phones to digits-only', () => {
    expect(normalizePhone('(021) 123 4567')).toBe('0211234567');
    expect(normalizePhone(undefined)).toBe('');
  });

  it('computes today in the portal timezone instead of the server machine timezone', () => {
    expect(todayYmd('2026-04-05T11:59:59.000Z')).toBe('2026-04-05');
    expect(todayYmd('2026-04-05T12:00:00.000Z')).toBe('2026-04-06');
  });
});
