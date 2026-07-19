import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { qk } from './keys';
import {
  projectsIndexPlaceholderFromCaches,
  seedProjectsIndexCanonicalCaches,
  type ProjectsIndexResponse,
} from './projectsIndex';

const activeProject = { id: 'proj_active', projectName: 'Active', status: 'NEW', isArchived: false } as any;
const archivedProject = { id: 'proj_archived', projectName: 'Archived', status: 'NEW', isArchived: true } as any;
const contact = { id: 'ct_1', displayName: 'Alex' } as any;

describe('projects index query cache', () => {
  it('builds active and archived placeholders only from the current query client and host', () => {
    const client = new QueryClient();
    client.setQueryData(qk.projects.list('host-a', 'all'), [activeProject, archivedProject]);
    client.setQueryData(qk.contacts.list('host-a'), [contact]);

    expect(projectsIndexPlaceholderFromCaches(client, 'host-a', 'active')?.projects.rows).toEqual([activeProject]);
    expect(projectsIndexPlaceholderFromCaches(client, 'host-a', 'archived')?.projects.rows).toEqual([archivedProject]);
    expect(projectsIndexPlaceholderFromCaches(client, 'host-a', 'all')?.projects.rows).toEqual([activeProject, archivedProject]);
    expect(projectsIndexPlaceholderFromCaches(client, 'host-b', 'active')).toBeUndefined();
  });

  it('never treats an active-only list as a complete all or archived cache', () => {
    const client = new QueryClient();
    client.setQueryData(qk.projects.list('host', 'active'), [activeProject]);

    expect(projectsIndexPlaceholderFromCaches(client, 'host', 'active')?.projects.rows).toEqual([activeProject]);
    expect(projectsIndexPlaceholderFromCaches(client, 'host', 'archived')).toBeUndefined();
    expect(projectsIndexPlaceholderFromCaches(client, 'host', 'all')).toBeUndefined();
  });

  it('never reads another authenticated user query client', () => {
    const userA = new QueryClient();
    const userB = new QueryClient();
    userA.setQueryData(qk.projects.list('host', 'active'), [activeProject]);
    userA.setQueryData(qk.contacts.list('host'), [contact]);

    expect(projectsIndexPlaceholderFromCaches(userA, 'host', 'active')?.projects.rows).toEqual([activeProject]);
    expect(projectsIndexPlaceholderFromCaches(userB, 'host', 'active')).toBeUndefined();
  });

  it('seeds canonical caches from complete fresh scopes without treating archived-only data as complete', () => {
    const client = new QueryClient();
    const response = (archive: ProjectsIndexResponse['archive'], rows: any[]): ProjectsIndexResponse => ({
      archive,
      projects: { rows, totalCount: rows.length, truncated: false },
      contacts: { rows: [contact], totalCount: 1, truncated: false },
      generatedAt: '2026-07-19T00:00:00.000Z',
    });

    seedProjectsIndexCanonicalCaches(client, 'host', response('all', [activeProject, archivedProject]));
    expect(client.getQueryData(qk.projects.list('host', 'all'))).toEqual([activeProject, archivedProject]);
    expect(client.getQueryData(qk.projects.list('host', 'active'))).toEqual([activeProject]);
    expect(client.getQueryData(qk.contacts.list('host'))).toEqual([contact]);

    client.removeQueries({ queryKey: qk.projects.listPrefix('host') });
    seedProjectsIndexCanonicalCaches(client, 'host', response('archived', [archivedProject]));
    expect(client.getQueryData(qk.projects.list('host', 'active'))).toBeUndefined();
    expect(client.getQueryData(qk.projects.list('host', 'all'))).toBeUndefined();
  });
});
