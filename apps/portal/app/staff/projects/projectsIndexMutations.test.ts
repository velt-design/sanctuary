import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { qk } from '@/lib/queries/keys';
import { PROJECTS_INDEX_QUERY_SCOPE, type ProjectsIndexResponse } from '@/lib/queries/projectsIndex';
import { apiJson } from '@/lib/repo/apiClient';
import { correctProjectStage } from '@/lib/repo/projectsRepo';
import {
  correctProjectIndexStage,
  saveProjectIndexInlineEdit,
  setProjectIndexArchived,
} from './projectsIndexMutations';

vi.mock('@/lib/repo/apiClient', () => ({ apiJson: vi.fn() }));
vi.mock('@/lib/repo/projectsRepo', () => ({ correctProjectStage: vi.fn() }));

const project: Project = {
  id: 'proj_1',
  contactId: 'ct_1',
  projectName: 'Original project',
  name: 'Original project',
  siteAddress: '1 Old Road',
  address: '1 Old Road',
  status: 'NEW',
  isArchived: false,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
};

const contact: Contact = {
  id: 'ct_1',
  displayName: 'Alex Mason',
  phone: '111',
  email: 'alex@example.com',
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
};

function response(archive: ProjectsIndexResponse['archive'], rows: Project[]): ProjectsIndexResponse {
  return {
    archive,
    projects: { rows, totalCount: rows.length, truncated: false, page: 1, pageSize: 50, totalPages: 1 },
    contacts: { rows: [contact], totalCount: 1, truncated: false },
    query: { search: '', status: 'all', due: 'all', today: '2026-07-29', sort: 'newest' },
    generatedAt: '2026-07-19T00:00:00.000Z',
  };
}

function seededClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(qk.projects.list('host', 'active'), [project]);
  client.setQueryData(qk.projects.list('host', 'all'), [project]);
  client.setQueryData(qk.contacts.list('host'), [contact]);
  client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'), response('active', [project]));
  client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'archived'), response('archived', []));
  client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'all'), response('all', [project]));
  return client;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('projectsIndexMutations', () => {
  beforeEach(() => {
    vi.mocked(apiJson).mockReset();
    vi.mocked(correctProjectStage).mockReset();
  });

  it('shows an inline edit from cache before the server responds', async () => {
    const client = seededClient();
    const request = deferred<unknown>();
    vi.mocked(apiJson).mockReturnValue(request.promise as never);

    const save = saveProjectIndexInlineEdit({
      queryClient: client,
      host: 'host',
      project,
      contact,
      field: 'name',
      value: 'Instant project',
    });

    expect(client.getQueryData<Project[]>(qk.projects.list('host', 'active'))?.[0].projectName)
      .toBe('Instant project');
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'))?.projects.rows[0].projectName)
      .toBe('Instant project');

    request.resolve({});
    await save;
  });

  it('rolls back only the rejected inline field and never touches another user QueryClient', async () => {
    const userA = seededClient();
    const userB = seededClient();
    const request = deferred<unknown>();
    vi.mocked(apiJson).mockReturnValue(request.promise as never);

    const save = saveProjectIndexInlineEdit({
      queryClient: userA,
      host: 'host',
      project,
      contact,
      field: 'phone',
      value: '222',
    });

    expect(userA.getQueryData<Contact[]>(qk.contacts.list('host'))?.[0].phone).toBe('222');
    expect(userB.getQueryData<Contact[]>(qk.contacts.list('host'))?.[0].phone).toBe('111');

    request.reject(new Error('offline'));
    await expect(save).rejects.toThrow('offline');
    expect(userA.getQueryData<Contact[]>(qk.contacts.list('host'))?.[0].phone).toBe('111');
  });

  it('shows a stage correction immediately and restores it on failure', async () => {
    const client = seededClient();
    const request = deferred<Awaited<ReturnType<typeof correctProjectStage>>>();
    vi.mocked(correctProjectStage).mockReturnValue(request.promise);

    const save = correctProjectIndexStage({
      queryClient: client,
      host: 'host',
      project,
      correction: { projectId: project.id, nextStage: 'contacted', reason: null },
    });

    expect(client.getQueryData<Project[]>(qk.projects.list('host', 'active'))?.[0].status).toBe('CONTACTED');

    request.reject(new Error('stage rejected'));
    await expect(save).rejects.toThrow('stage rejected');
    expect(client.getQueryData<Project[]>(qk.projects.list('host', 'active'))?.[0].status).toBe('NEW');
  });

  it('moves an archived row immediately and restores the same row after rejection', async () => {
    const client = seededClient();
    const request = deferred<unknown>();
    vi.mocked(apiJson).mockReturnValue(request.promise as never);

    const save = setProjectIndexArchived({
      queryClient: client,
      host: 'host',
      project,
      isArchived: true,
    });

    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'))?.projects.rows)
      .toEqual([]);
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'archived'))?.projects.rows[0])
      .toMatchObject({ id: 'proj_1', isArchived: true });

    request.reject(new Error('archive rejected'));
    await expect(save).rejects.toThrow('archive rejected');
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'))?.projects.rows[0])
      .toMatchObject({ id: 'proj_1', isArchived: false });
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'archived'))?.projects.rows)
      .toEqual([]);
  });
});
