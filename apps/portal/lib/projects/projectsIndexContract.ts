import type { Contact } from '@/lib/types/contact';
import {
  PROJECT_EFFECTIVE_STATES,
  PROJECT_STATUS_ORDER,
  type Project,
  type ProjectEffectiveState,
  type ProjectStatus,
} from '@/lib/types/project';
import {
  PROJECT_JOURNEY_PHASES,
  type ProjectJourneyPhase,
} from '@/lib/projects/projectJourney';

const PROJECTS_INDEX_ARCHIVE_FILTERS = ['active', 'archived', 'all'] as const;
const PROJECTS_INDEX_SORTS = ['newest', 'oldest', 'name_asc', 'name_desc'] as const;
const PROJECTS_INDEX_PAGE_SIZES = [25, 50, 100] as const;

export type ProjectsIndexArchiveFilter = (typeof PROJECTS_INDEX_ARCHIVE_FILTERS)[number];
export type ProjectsIndexJourneyFilter = ProjectJourneyPhase | 'all';
export type ProjectsIndexStateFilter = ProjectEffectiveState | 'all';
export type ProjectsIndexSort = (typeof PROJECTS_INDEX_SORTS)[number];
export type ProjectsIndexPageSize = (typeof PROJECTS_INDEX_PAGE_SIZES)[number];

export type ProjectsIndexParams = {
  archive: ProjectsIndexArchiveFilter;
  search: string;
  status: ProjectStatus | 'all';
  journey: ProjectsIndexJourneyFilter;
  state: ProjectsIndexStateFilter;
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

export function isProjectsIndexJourneyFilter(value: string): value is ProjectsIndexJourneyFilter {
  return value === 'all'
    || PROJECT_JOURNEY_PHASES.includes(value as ProjectJourneyPhase);
}

export function isProjectsIndexStateFilter(value: string): value is ProjectsIndexStateFilter {
  return value === 'all'
    || PROJECT_EFFECTIVE_STATES.includes(value as ProjectEffectiveState);
}

export function isProjectsIndexStatusFilter(value: string): value is ProjectStatus | 'all' {
  return value === 'all' || PROJECT_STATUS_ORDER.includes(value as ProjectStatus);
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
