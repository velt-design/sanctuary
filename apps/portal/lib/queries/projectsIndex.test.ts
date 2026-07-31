import { describe, expect, it } from 'vitest';
import { qk } from './keys';
import {
  defaultProjectsIndexParams,
  PROJECTS_INDEX_QUERY_SCOPE,
  projectsIndexQueryOptions,
} from './projectsIndex';

describe('projects index query', () => {
  it('keeps every server-filtered page in a distinct user-owned query key', () => {
    const base = defaultProjectsIndexParams('active');
    const params = {
      ...base,
      search: 'deck',
      status: 'QUOTING' as const,
      journey: 'PROPOSAL' as const,
      state: 'WAITING' as const,
      page: 2,
      pageSize: 25 as const,
      sort: 'name_asc' as const,
    };
    const options = projectsIndexQueryOptions('active', params);
    expect(options.queryKey).toEqual(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active', {
      search: 'deck',
      status: 'QUOTING',
      journey: 'PROPOSAL',
      state: 'WAITING',
      page: 2,
      pageSize: 25,
      sort: 'name_asc',
    }));
  });

  it('does not share active, archived, or all scopes', () => {
    const active = projectsIndexQueryOptions('active').queryKey;
    const archived = projectsIndexQueryOptions('archived').queryKey;
    const all = projectsIndexQueryOptions('all').queryKey;
    expect(active).not.toEqual(archived);
    expect(active).not.toEqual(all);
    expect(archived).not.toEqual(all);
  });

  it('does not share journey or state filtered pages', () => {
    const base = defaultProjectsIndexParams('active');
    const proposal = projectsIndexQueryOptions('active', {
      ...base,
      journey: 'PROPOSAL',
    }).queryKey;
    const waiting = projectsIndexQueryOptions('active', {
      ...base,
      state: 'WAITING',
    }).queryKey;

    expect(proposal).not.toEqual(projectsIndexQueryOptions('active', base).queryKey);
    expect(waiting).not.toEqual(projectsIndexQueryOptions('active', base).queryKey);
    expect(proposal).not.toEqual(waiting);
  });
});
