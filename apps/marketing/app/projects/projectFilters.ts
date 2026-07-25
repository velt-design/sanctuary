import type { Project } from '../../data/projects';
import { getProjectFormLabel } from './projectPresentation';

export const ALL_PROJECT_FILTERS = 'all';

export const PROJECT_AUDIENCE_OPTIONS = [
  { label: 'Residential', value: 'residential' },
  { label: 'Commercial', value: 'commercial' },
] as const;

export type ProjectAudienceFilter =
  | typeof ALL_PROJECT_FILTERS
  | (typeof PROJECT_AUDIENCE_OPTIONS)[number]['value'];

export type ProjectFilters = {
  audience: ProjectAudienceFilter;
  form: string;
};

type SearchParamReader = Pick<URLSearchParams, 'get' | 'toString'>;
type ProjectFilterItem = Pick<Project, 'roof' | 'type'>;

function toFilterValue(label: string): string {
  return label.toLowerCase();
}

export function getProjectFormOptions(projects: ProjectFilterItem[]) {
  return Array.from(new Set(projects.map(getProjectFormLabel)))
    .sort()
    .map((label) => ({ label, value: toFilterValue(label) }));
}

export function readProjectFilters(
  searchParams: SearchParamReader,
  projects: ProjectFilterItem[],
): ProjectFilters {
  const audienceParam = searchParams.get('audience');
  const formParam = searchParams.get('form');
  const audience = PROJECT_AUDIENCE_OPTIONS.some(
    (option) => option.value === audienceParam,
  )
    ? audienceParam as ProjectAudienceFilter
    : ALL_PROJECT_FILTERS;
  const form = getProjectFormOptions(projects).some(
    (option) => option.value === formParam,
  )
    ? formParam ?? ALL_PROJECT_FILTERS
    : ALL_PROJECT_FILTERS;

  return { audience, form };
}

export function filterProjects<ProjectItem extends ProjectFilterItem>(
  projects: ProjectItem[],
  filters: ProjectFilters,
): ProjectItem[] {
  return projects.filter((project) => (
    (
      filters.audience === ALL_PROJECT_FILTERS
      || project.type.toLowerCase() === filters.audience
    )
    && (
      filters.form === ALL_PROJECT_FILTERS
      || toFilterValue(getProjectFormLabel(project)) === filters.form
    )
  ));
}

export function buildProjectFilterHref(
  pathname: string,
  searchParams: SearchParamReader,
  filters: ProjectFilters,
): string {
  const nextSearchParams = new URLSearchParams(searchParams.toString());

  if (filters.audience === ALL_PROJECT_FILTERS) {
    nextSearchParams.delete('audience');
  } else {
    nextSearchParams.set('audience', filters.audience);
  }

  if (filters.form === ALL_PROJECT_FILTERS) {
    nextSearchParams.delete('form');
  } else {
    nextSearchParams.set('form', filters.form);
  }

  const query = nextSearchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
