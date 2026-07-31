import { describe, expect, it } from 'vitest';
import type {
  ProjectsIndexParams,
  ProjectsIndexResponse,
} from '@/lib/projects/projectsIndexContract';
import { projectsIndexResponseMatchesRequest } from './useProjectsIndexData';

const params: ProjectsIndexParams = {
  archive: 'active',
  search: ' deck ',
  status: 'SENT',
  journey: 'PROPOSAL',
  state: 'WAITING',
  page: 2,
  pageSize: 25,
  sort: 'name_asc',
};

const response: ProjectsIndexResponse = {
  archive: 'active',
  projects: {
    rows: [],
    totalCount: 0,
    truncated: false,
    page: 2,
    pageSize: 25,
    totalPages: 1,
  },
  contacts: { rows: [], totalCount: 0, truncated: false },
  query: {
    search: 'deck',
    status: 'SENT',
    journey: 'PROPOSAL',
    state: 'WAITING',
    sort: 'name_asc',
  },
  generatedAt: '2026-07-31T00:00:00.000Z',
};

describe('projectsIndexResponseMatchesRequest', () => {
  it('accepts the exact server-confirmed response', () => {
    expect(projectsIndexResponseMatchesRequest(response, params)).toBe(true);
  });

  it('rejects stale journey and state responses', () => {
    expect(
      projectsIndexResponseMatchesRequest(
        { ...response, query: { ...response.query, journey: 'ENQUIRY' } },
        params,
      ),
    ).toBe(false);
    expect(
      projectsIndexResponseMatchesRequest(
        { ...response, query: { ...response.query, state: 'ACTIVE' } },
        params,
      ),
    ).toBe(false);
  });

  it('rejects a stale archive scope or page', () => {
    expect(
      projectsIndexResponseMatchesRequest({ ...response, archive: 'archived' }, params),
    ).toBe(false);
    expect(
      projectsIndexResponseMatchesRequest(
        { ...response, projects: { ...response.projects, page: 1 } },
        params,
      ),
    ).toBe(false);
  });
});
