import { isProjectsIndexSort } from '@/lib/projects/projectsIndexContract';
import type { ProjectsIndexPageSize, ProjectsIndexSort } from '@/lib/projects/projectsIndexContract';
import { parseProjectsIndexFilters, type ProjectsIndexFilters } from './projectIndexFilters';

export type ProjectIndexView = ProjectsIndexFilters & {
  sort: ProjectsIndexSort;
  page: number;
  pageSize: ProjectsIndexPageSize;
};

export function parseProjectIndexView(params: URLSearchParams): ProjectIndexView {
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? 50);
  const sort = params.get('sort') ?? 'newest';
  return {
    ...parseProjectsIndexFilters(params),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: pageSize === 25 || pageSize === 50 || pageSize === 100 ? pageSize : 50,
    sort: isProjectsIndexSort(sort) ? sort : 'newest',
  };
}

export function projectIndexViewHref(view: ProjectIndexView, context = new URLSearchParams()): string {
  const params = new URLSearchParams(context);
  for (const key of ['q', 'stage', 'status', 'journey', 'state', 'owner', 'archive', 'sort', 'page', 'pageSize', '__portal_opening', 'toast']) params.delete(key);
  const entries = {
    q: view.query, stage: view.stageFilter, journey: view.journeyFilter,
    state: view.stateFilter, owner: view.ownerFilter, archive: view.archiveFilter,
    sort: view.sort, page: String(view.page), pageSize: String(view.pageSize),
  };
  for (const [key, value] of Object.entries(entries)) params.set(key, value);
  params.sort();
  return '/staff/projects?' + params.toString();
}
