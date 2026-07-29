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
      page: 2,
      pageSize: 25 as const,
      sort: 'name_asc' as const,
    };
    const options = projectsIndexQueryOptions('active', params);
    expect(options.queryKey).toEqual(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active', {
      search: 'deck',
      status: 'QUOTING',
      due: 'all',
      today: base.today,
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
});
