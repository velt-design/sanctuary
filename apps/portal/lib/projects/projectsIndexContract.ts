import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';

const PROJECTS_INDEX_ARCHIVE_FILTERS = ['active', 'archived', 'all'] as const;
export type ProjectsIndexArchiveFilter = (typeof PROJECTS_INDEX_ARCHIVE_FILTERS)[number];

type ProjectsIndexList<T> = {
  rows: T[];
  totalCount: number | null;
  truncated: boolean;
};

export type ProjectsIndexResponse = {
  archive: ProjectsIndexArchiveFilter;
  projects: ProjectsIndexList<Project>;
  contacts: ProjectsIndexList<Contact>;
  generatedAt: string;
};

export function isProjectsIndexArchiveFilter(value: string): value is ProjectsIndexArchiveFilter {
  return PROJECTS_INDEX_ARCHIVE_FILTERS.includes(value as ProjectsIndexArchiveFilter);
}
