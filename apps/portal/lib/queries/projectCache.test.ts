import { describe, expect, it, vi } from 'vitest';
import {
  buildProjectSnapshotPlaceholder,
  getProjectSnapshotPlaceholderFromCaches,
  invalidateProjectReadCaches,
  invalidateProjectsIndexCaches,
  patchContactListItem,
  patchProjectListItem,
  removeProjectListItem,
  upsertProjectListItem,
} from './projectCache';
import { qk } from './keys';
import { QueryClient } from '@tanstack/react-query';
import { PROJECTS_INDEX_QUERY_SCOPE, type ProjectsIndexResponse } from './projectsIndex';

describe('projectCache helpers', () => {
  it('builds a usable project snapshot placeholder from a project summary', () => {
    const placeholder = buildProjectSnapshotPlaceholder({
      id: 'proj_123',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      status: 'QUOTING',
      isArchived: false,
      isLost: false,
      legacyStatus: 'QUOTING',
      projectName: 'Beach House',
      name: 'Beach House',
      contactId: 'ct_1',
      clientName: 'Alex',
      region: 'North',
      quoteRef: 'Q-100',
      siteAddress: '1 Ocean Road',
      address: '1 Ocean Road',
      nextActionDate: '2026-03-05',
      followUpDate: '2026-03-05',
      notes: '',
    });

    expect(placeholder.snapshot.project.id).toBe('proj_123');
    expect(placeholder.snapshot.project.name).toBe('Beach House');
    expect(placeholder.snapshot.project.contactId).toBe('ct_1');
    expect(placeholder.snapshot.pipeline.stage).toBe('quoting');
    expect(placeholder.generatedAt).toBe('2026-03-02T00:00:00.000Z');
  });

  it('invalidates the expected read keys for a project', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await invalidateProjectReadCaches(
      { invalidateQueries } as any,
      'host',
      'proj_123',
      { includeQuotes: true, includeEstimates: true },
    );

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.projects.summary('host', 'proj_123') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.projects.snapshot('host', 'proj_123') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.projects.commandCentre('host', 'proj_123') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.projectWork.queue('host') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.dashboard.dataPrefix() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.projects.detail('host', 'proj_123') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.projects.listPrefix('host') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.projects.indexPrefix(PROJECTS_INDEX_QUERY_SCOPE) });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.quotes.versionsByProject('host', 'proj_123') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.estimates.metaByProject('host', 'proj_123') });
  });

  it('invalidates the queue and dashboard after project index membership changes', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await invalidateProjectsIndexCaches(
      { invalidateQueries } as any,
      'host',
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: qk.projectWork.queue('host'),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: qk.dashboard.dataPrefix(),
    });
  });

  it.each([
    ['active', 'active', false],
    ['archived', 'all', true],
    ['all', 'all', false],
  ] as const)('builds a summary from the %s project view cache and enriches it from contacts', (_view, scope, isArchived) => {
    const values = new Map<string, unknown>([
      [JSON.stringify(qk.projects.list('host', scope)), [{
        id: 'proj_123',
        contactId: 'ct_1',
        projectName: 'Beach House',
        status: 'QUOTING',
        isArchived,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
      }]],
      [JSON.stringify(qk.contacts.list('host')), [{
        id: 'ct_1',
        displayName: 'Alex Mason',
        email: 'alex@example.com',
        phone: '021 123 4567',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
      }]],
    ]);
    const queryClient = {
      getQueriesData: () => [],
      getQueryData: (key: readonly unknown[]) => values.get(JSON.stringify(key)),
    } as any;

    const result = getProjectSnapshotPlaceholderFromCaches(queryClient, 'host', 'proj_123');

    expect(result?.snapshot.project.name).toBe('Beach House');
    expect(result?.snapshot.project.contactName).toBe('Alex Mason');
    expect(result?.snapshot.project.contactEmail).toBe('alex@example.com');
    expect(result?.snapshot.project.contactPhone).toBe('021 123 4567');
  });

  it('builds the immediate project shell from the current Projects Index cache', () => {
    const client = new QueryClient();
    const response: ProjectsIndexResponse = {
      archive: 'active',
      projects: {
        rows: [{
          id: 'proj_123',
          contactId: 'ct_1',
          projectName: 'Beach House',
          status: 'QUOTING',
          isArchived: false,
          siteAddress: '1 Ocean Road',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-02T00:00:00.000Z',
        }],
        totalCount: 1,
        truncated: false,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      },
      contacts: {
        rows: [{
          id: 'ct_1',
          displayName: 'Alex Mason',
          email: 'alex@example.com',
          phone: '021 123 4567',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-02T00:00:00.000Z',
        }],
        totalCount: 1,
        truncated: false,
      },
      query: {
        search: '',
        status: 'all',
        journey: 'all',
        state: 'all',
        owner: 'all',
        sort: 'newest',
      },
      generatedAt: '2026-03-02T00:00:00.000Z',
    };
    client.setQueryData(
      qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'),
      response,
    );

    const result = getProjectSnapshotPlaceholderFromCaches(client, 'host', 'proj_123');

    expect(result).toMatchObject({
      generatedAt: '2026-03-02T00:00:00.000Z',
      snapshot: {
        project: {
          id: 'proj_123',
          name: 'Beach House',
          contactId: 'ct_1',
          contactName: 'Alex Mason',
          contactEmail: 'alex@example.com',
          contactPhone: '021 123 4567',
          siteAddress: '1 Ocean Road',
        },
        pipeline: { stage: 'quoting' },
      },
    });
  });

  it('never reads a project from another query client or host boundary', () => {
    const userA = {
      getQueriesData: () => [],
      getQueryData: (key: readonly unknown[]) =>
        JSON.stringify(key) === JSON.stringify(qk.projects.list('host-a', 'active'))
          ? [{ id: 'proj_private', projectName: 'Private', status: 'NEW' }]
          : undefined,
    } as any;
    const userB = { getQueriesData: () => [], getQueryData: () => undefined } as any;

    expect(getProjectSnapshotPlaceholderFromCaches(userA, 'host-a', 'proj_private')).toBeDefined();
    expect(getProjectSnapshotPlaceholderFromCaches(userA, 'host-b', 'proj_private')).toBeUndefined();
    expect(getProjectSnapshotPlaceholderFromCaches(userB, 'host-a', 'proj_private')).toBeUndefined();
  });

  it('keeps canonical and combined index caches coherent for edits, archive, contacts, and deletion', () => {
    const client = new QueryClient();
    const project = { id: 'proj_1', projectName: 'Original', status: 'NEW', isArchived: false } as any;
    const contact = { id: 'ct_1', displayName: 'Alex', phone: '111' } as any;
    const response = (archive: ProjectsIndexResponse['archive']): ProjectsIndexResponse => ({
      archive,
      projects: { rows: [project], totalCount: 1, truncated: false, page: 1, pageSize: 50, totalPages: 1 },
      contacts: { rows: [contact], totalCount: 1, truncated: false },
      query: { search: '', status: 'all', journey: 'all', state: 'all', owner: 'all', sort: 'newest' },
      generatedAt: '2026-07-19T00:00:00.000Z',
    });
    client.setQueryData(qk.projects.list('host', 'active'), [project]);
    client.setQueryData(qk.projects.list('host', 'all'), [project]);
    client.setQueryData(qk.contacts.list('host'), [contact]);
    client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'), response('active'));
    client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'all'), response('all'));

    patchProjectListItem(client, 'host', 'proj_1', (current) => ({
      ...current,
      projectName: 'Updated',
      isArchived: true,
    }));
    expect(client.getQueryData<any[]>(qk.projects.list('host', 'active'))).toEqual([]);
    expect(client.getQueryData<any[]>(qk.projects.list('host', 'all'))?.[0]).toMatchObject({
      projectName: 'Updated',
      isArchived: true,
    });
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'))?.projects.rows).toEqual([]);

    patchContactListItem(client, 'host', 'ct_1', (current) => ({ ...current, phone: '222' }));
    expect(client.getQueryData<any[]>(qk.contacts.list('host'))?.[0].phone).toBe('222');
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'all'))?.contacts.rows[0].phone).toBe('222');

    removeProjectListItem(client, 'host', 'proj_1');
    expect(client.getQueryData<any[]>(qk.projects.list('host', 'all'))).toEqual([]);
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'all'))?.projects.rows).toEqual([]);
  });

  it('moves an upserted project between archive scopes and keeps known counts reversible', () => {
    const client = new QueryClient();
    const project = {
      id: 'proj_1',
      projectName: 'Original',
      status: 'NEW',
      isArchived: false,
      createdAt: '2026-07-19T00:00:00.000Z',
    } as any;
    const response = (archive: ProjectsIndexResponse['archive'], rows: any[], totalCount: number): ProjectsIndexResponse => ({
      archive,
      projects: { rows, totalCount, truncated: false, page: 1, pageSize: 50, totalPages: Math.max(1, Math.ceil(totalCount / 50)) },
      contacts: { rows: [], totalCount: 0, truncated: false },
      query: { search: '', status: 'all', journey: 'all', state: 'all', owner: 'all', sort: 'newest' },
      generatedAt: '2026-07-19T00:00:00.000Z',
    });

    client.setQueryData(qk.projects.list('host', 'active'), [project]);
    client.setQueryData(qk.projects.list('host', 'all'), [project]);
    client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'), response('active', [project], 1));
    client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'archived'), response('archived', [], 0));
    client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'all'), response('all', [project], 1));

    upsertProjectListItem(client, 'host', { ...project, isArchived: true });

    expect(client.getQueryData<any[]>(qk.projects.list('host', 'active'))).toEqual([]);
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'))?.projects)
      .toMatchObject({ rows: [], totalCount: 0 });
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'archived'))?.projects)
      .toMatchObject({ rows: [expect.objectContaining({ id: 'proj_1', isArchived: true })], totalCount: 1 });

    upsertProjectListItem(client, 'host', { ...project, projectName: 'Still current', isArchived: false });

    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'))?.projects)
      .toMatchObject({ rows: [expect.objectContaining({ projectName: 'Still current', isArchived: false })], totalCount: 1 });
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'archived'))?.projects)
      .toMatchObject({ rows: [], totalCount: 0 });
  });

  it('does not optimistically insert unknown projects into journey or state filtered pages', () => {
    const client = new QueryClient();
    const base: ProjectsIndexResponse = {
      archive: 'active',
      projects: {
        rows: [],
        totalCount: 0,
        truncated: false,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      },
      contacts: { rows: [], totalCount: 0, truncated: false },
      query: {
        search: '',
        status: 'all',
        journey: 'PROPOSAL',
        state: 'all',
        owner: 'all',
        sort: 'newest',
      },
      generatedAt: '2026-07-31T00:00:00.000Z',
    };
    const journeyKey = qk.projects.index(
      PROJECTS_INDEX_QUERY_SCOPE,
      'active',
      { journey: 'PROPOSAL' },
    );
    const stateKey = qk.projects.index(
      PROJECTS_INDEX_QUERY_SCOPE,
      'active',
      { state: 'WAITING' },
    );
    client.setQueryData(journeyKey, base);
    client.setQueryData(stateKey, {
      ...base,
      query: { ...base.query, journey: 'all', state: 'WAITING' },
    });

    upsertProjectListItem(client, 'host', {
      id: 'proj_new',
      projectName: 'New project',
      createdAt: '2026-07-31T00:00:00.000Z',
      status: 'SENT',
      effectiveState: 'WAITING',
    });

    expect(
      client.getQueryData<ProjectsIndexResponse>(journeyKey)?.projects.rows,
    ).toEqual([]);
    expect(
      client.getQueryData<ProjectsIndexResponse>(stateKey)?.projects.rows,
    ).toEqual([]);
  });

  it('does not patch existing rows inside server-filtered index pages', () => {
    const client = new QueryClient();
    const existing = {
      id: 'proj_filtered',
      projectName: 'Filtered project',
      status: 'NEW',
      isArchived: false,
    } as any;
    const filteredKey = qk.projects.index(
      PROJECTS_INDEX_QUERY_SCOPE,
      'active',
      { journey: 'ENQUIRY' },
    );
    client.setQueryData<ProjectsIndexResponse>(filteredKey, {
      archive: 'active',
      projects: {
        rows: [existing],
        totalCount: 1,
        truncated: false,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      },
      contacts: { rows: [], totalCount: 0, truncated: false },
      query: {
        search: '',
        status: 'all',
        journey: 'ENQUIRY',
        state: 'all',
        owner: 'all',
        sort: 'newest',
      },
      generatedAt: '2026-07-31T00:00:00.000Z',
    });

    upsertProjectListItem(client, 'host', {
      ...existing,
      status: 'SENT',
    });

    expect(
      client.getQueryData<ProjectsIndexResponse>(filteredKey)?.projects.rows[0],
    ).toMatchObject({ status: 'NEW' });
  });
});
