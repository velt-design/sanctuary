import { describe, expect, it } from 'vitest';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import {
  buildContactsById,
  filterProjectsForIndex,
  normalizePhone,
  parseProjectsIndexFilters,
} from './projectIndexFilters';

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
    operationalState: 'WAITING',
    effectiveState: 'WAITING',
  },
  {
    id: 'proj_2',
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
    projectName: 'Pergola',
    region: 'South',
    status: 'NEW',
    operationalState: 'ACTIVE',
    effectiveState: 'ACTIVE',
  },
];

const allFilters = {
  query: '',
  journeyFilter: 'all',
  stageFilter: 'all',
  stateFilter: 'all',
  ownerFilter: 'all',
  archiveFilter: 'active',
} as const;

describe('projectIndexFilters', () => {
  it('parses journey, detailed stage, and server-owned state filters', () => {
    expect(
      parseProjectsIndexFilters(
        new URLSearchParams('q=deck&journey=proposal&stage=sent&state=waiting&owner=jordan'),
      ),
    ).toEqual({
      query: 'deck',
      journeyFilter: 'PROPOSAL',
      stageFilter: 'SENT',
      stateFilter: 'WAITING',
      ownerFilter: 'jordan',
      archiveFilter: 'active',
    });
  });

  it('keeps the legacy status and archive query aliases readable', () => {
    expect(parseProjectsIndexFilters(new URLSearchParams('status=sent'))).toEqual({
      ...allFilters,
      stageFilter: 'SENT',
    });
    expect(parseProjectsIndexFilters(new URLSearchParams('archive=archived'))).toEqual({
      ...allFilters,
      stateFilter: 'ARCHIVED',
      archiveFilter: 'archived',
    });
    expect(parseProjectsIndexFilters(new URLSearchParams('archive=all'))).toEqual({
      ...allFilters,
      archiveFilter: 'all',
    });
    expect(
      parseProjectsIndexFilters(new URLSearchParams('archive=all&state=all')),
    ).toEqual({
      ...allFilters,
      archiveFilter: 'all',
    });
  });

  it('lets an explicit state own the hidden archive scope', () => {
    expect(
      parseProjectsIndexFilters(new URLSearchParams('state=active&archive=archived')),
    ).toEqual({
      ...allFilters,
      stateFilter: 'ACTIVE',
    });
    expect(parseProjectsIndexFilters(new URLSearchParams('state=archived'))).toEqual({
      ...allFilters,
      stateFilter: 'ARCHIVED',
      archiveFilter: 'archived',
    });
  });

  it('filters by canonical journey, detailed stage, and effective state', () => {
    expect(
      filterProjectsForIndex(projects, buildContactsById(contacts), {
        query: 'alex',
        journeyFilter: 'PROPOSAL',
        stageFilter: 'SENT',
        stateFilter: 'WAITING',
        ownerFilter: 'all',
        archiveFilter: 'active',
      }).map((project) => project.id),
    ).toEqual(['proj_1']);
  });

  it('does not derive operational state from archive or stage in browser code', () => {
    const project: Project = {
      id: 'proj_archived',
      createdAt: '2026-04-03T00:00:00.000Z',
      projectName: 'Archived Job',
      status: 'PAID',
      isArchived: true,
    };

    expect(
      filterProjectsForIndex([project], new Map(), {
        ...allFilters,
        stateFilter: 'ARCHIVED',
        archiveFilter: 'archived',
      }),
    ).toEqual([]);
  });

  it('matches formatted and digits-only phone searches', () => {
    const phoneContact: Contact = {
      id: 'ct_phone',
      displayName: 'Phone Person',
      email: '',
      phone: '021 123 4567',
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
    };
    const phoneProject: Project = {
      id: 'proj_phone',
      createdAt: '2026-04-03T00:00:00.000Z',
      contactId: 'ct_phone',
      projectName: 'Phone Job',
      status: 'NEW',
    };
    const contactsById = buildContactsById([phoneContact]);

    expect(
      filterProjectsForIndex(
        [phoneProject],
        contactsById,
        { ...allFilters, query: '0211234567' },
      ),
    ).toHaveLength(1);
    expect(
      filterProjectsForIndex(
        [phoneProject],
        contactsById,
        { ...allFilters, query: '021 123' },
      ),
    ).toHaveLength(1);
    expect(normalizePhone('(021) 123 4567')).toBe('0211234567');
  });
});
