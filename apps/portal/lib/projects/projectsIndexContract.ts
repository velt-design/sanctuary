import type { Contact } from '@/lib/types/contact';
import type { Project, ProjectStatus } from '@/lib/types/project';

const PROJECTS_INDEX_ARCHIVE_FILTERS = ['active', 'archived', 'all'] as const;
const PROJECTS_INDEX_DUE_FILTERS = ['all', 'due', 'overdue', 'today'] as const;
const PROJECTS_INDEX_SORTS = ['newest', 'oldest', 'name_asc', 'name_desc', 'next_action_asc', 'next_action_desc'] as const;
const PROJECTS_INDEX_PAGE_SIZES = [25, 50, 100] as const;

export type ProjectsIndexArchiveFilter = (typeof PROJECTS_INDEX_ARCHIVE_FILTERS)[number];
type ProjectsIndexDueFilter = (typeof PROJECTS_INDEX_DUE_FILTERS)[number];
export type ProjectsIndexSort = (typeof PROJECTS_INDEX_SORTS)[number];
export type ProjectsIndexPageSize = (typeof PROJECTS_INDEX_PAGE_SIZES)[number];

export type ProjectsIndexParams = {
  archive: ProjectsIndexArchiveFilter;
  search: string;
  status: ProjectStatus | 'all';
  due: ProjectsIndexDueFilter;
  today: string;
  page: number;
  pageSize: ProjectsIndexPageSize;
  sort: ProjectsIndexSort;
};

type ProjectsIndexPage<T> = {
  rows: T[];
  totalCount: number | null;
  truncated: false;
  page: number;
  pageSize: ProjectsIndexPageSize;
  totalPages: number;
};

export type ProjectsIndexResponse = {
  archive: ProjectsIndexArchiveFilter;
  projects: ProjectsIndexPage<Project>;
  contacts: {
    rows: Contact[];
    totalCount: number | null;
    truncated: false;
  };
  query: Omit<ProjectsIndexParams, 'archive' | 'page' | 'pageSize'>;
  generatedAt: string;
};

export function isProjectsIndexArchiveFilter(value: string): value is ProjectsIndexArchiveFilter {
  return PROJECTS_INDEX_ARCHIVE_FILTERS.includes(value as ProjectsIndexArchiveFilter);
}

export function isProjectsIndexDueFilter(value: string): value is ProjectsIndexDueFilter {
  return PROJECTS_INDEX_DUE_FILTERS.includes(value as ProjectsIndexDueFilter);
}

export function isProjectsIndexSort(value: string): value is ProjectsIndexSort {
  return PROJECTS_INDEX_SORTS.includes(value as ProjectsIndexSort);
}

export function parseProjectsIndexPageSize(value: string | null): ProjectsIndexPageSize | null {
  const parsed = Number(value);
  return PROJECTS_INDEX_PAGE_SIZES.includes(parsed as ProjectsIndexPageSize)
    ? parsed as ProjectsIndexPageSize
    : null;
}
