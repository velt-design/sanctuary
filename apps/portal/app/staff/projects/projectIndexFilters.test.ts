import { describe, expect, it } from 'vitest';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { buildContactsById, filterProjectsForIndex, parseProjectsIndexFilters, todayYmd } from './projectIndexFilters';

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
    });

    expect(parseProjectsIndexFilters(new URLSearchParams('nextActionDue=1'))).toEqual({
      query: '',
      statusFilter: 'all',
      dueFilter: 'due',
    });
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
        },
        '2026-04-03',
      ).map((project) => project.id),
    ).toEqual(['proj_1']);
  });

  it('computes today in the portal timezone instead of the server machine timezone', () => {
    expect(todayYmd('2026-04-05T11:59:59.000Z')).toBe('2026-04-05');
    expect(todayYmd('2026-04-05T12:00:00.000Z')).toBe('2026-04-06');
  });
});
