import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProjectsIndexParams,
  ProjectsIndexResponse,
} from '@/lib/projects/projectsIndexContract';

const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn() }));

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: Symbol('keepPreviousData'),
  queryOptions: <T,>(options: T) => options,
  useQuery,
}));

import { projectsIndexResponseMatchesRequest, useProjectsIndexData } from './useProjectsIndexData';

const params: ProjectsIndexParams = {
  archive: 'active',
  search: ' deck ',
  status: 'SENT',
  journey: 'PROPOSAL',
  state: 'WAITING',
  owner: 'jordan',
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
    owner: 'jordan',
    sort: 'name_asc',
  },
  generatedAt: '2026-07-31T00:00:00.000Z',
};

describe('projectsIndexResponseMatchesRequest', () => {
  beforeEach(() => {
    useQuery.mockReset();
    useQuery.mockReturnValue({
      data: response,
      error: null,
      isFetching: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
  });

  it('keeps a fresh navigation-intent result instead of refetching on mount', () => {
    useProjectsIndexData(params);

    expect(useQuery).toHaveBeenCalledWith(expect.not.objectContaining({
      refetchOnMount: 'always',
    }));
  });

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
