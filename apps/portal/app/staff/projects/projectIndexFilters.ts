import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import {
  PROJECT_JOURNEY_PHASES,
  PROJECT_JOURNEY_PHASE_LABELS,
  resolveProjectJourney,
} from '@/lib/projects/projectJourney';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import {
  isProjectsIndexJourneyFilter,
  isProjectsIndexStateFilter,
  isProjectsIndexStatusFilter,
  type ProjectsIndexArchiveFilter,
  type ProjectsIndexJourneyFilter,
  type ProjectsIndexStateFilter,
} from '@/lib/projects/projectsIndexContract';
import {
  PROJECT_EFFECTIVE_STATES,
  PROJECT_STATUS_ORDER,
  projectStatusLabel,
  type ProjectStatus,
} from '@/lib/types/project';

export type ArchiveFilter = ProjectsIndexArchiveFilter;

export type ProjectsIndexFilters = {
  query: string;
  journeyFilter: ProjectsIndexJourneyFilter;
  stageFilter: ProjectStatus | 'all';
  stateFilter: ProjectsIndexStateFilter;
  archiveFilter: ArchiveFilter;
};

type SearchParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

export const PROJECT_JOURNEY_FILTER_OPTIONS = [
  { value: 'all', label: 'All journeys' },
  ...PROJECT_JOURNEY_PHASES.map((phase) => ({
    value: phase,
    label: PROJECT_JOURNEY_PHASE_LABELS[phase],
  })),
] as const;

export const PROJECT_STAGE_FILTER_OPTIONS = [
  { value: 'all', label: 'All stages' },
  ...PROJECT_STATUS_ORDER.map((stage) => ({
    value: stage,
    label: projectStatusLabel(stage),
  })),
] as const;

export const PROJECT_STATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All states' },
  ...PROJECT_EFFECTIVE_STATES.map((state) => ({
    value: state,
    label: state.charAt(0) + state.slice(1).toLowerCase(),
  })),
] as const;

function readFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return typeof value === 'string' ? value : '';
}

function readParam(source: SearchParamSource, key: string): string {
  if (typeof (source as URLSearchParams).get === 'function') return (source as URLSearchParams).get(key) ?? '';
  return readFirst((source as Record<string, string | string[] | undefined>)[key]);
}

export function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D+/g, '');
}

export function parseProjectsIndexFilters(searchParams: SearchParamSource): ProjectsIndexFilters {
  const stageParam = (
    readParam(searchParams, 'stage')
    || readParam(searchParams, 'status')
  ).trim().toUpperCase();
  const journeyParam = readParam(searchParams, 'journey').trim().toUpperCase();
  const stateParam = readParam(searchParams, 'state').trim().toUpperCase();
  const query = readParam(searchParams, 'q').trim();
  const archiveParam = readParam(searchParams, 'archive').trim().toLowerCase();

  const stageFilter = stageParam && stageParam !== 'ALL' && isProjectsIndexStatusFilter(stageParam)
    ? stageParam
    : 'all';
  const journeyFilter = journeyParam && journeyParam !== 'ALL' && isProjectsIndexJourneyFilter(journeyParam)
    ? journeyParam
    : 'all';
  const explicitState = Boolean(stateParam);
  const requestedState = stateParam === 'ALL' ? 'all' : stateParam;
  const stateFilter = explicitState && isProjectsIndexStateFilter(requestedState)
    ? requestedState
    : !explicitState && archiveParam === 'archived'
      ? 'ARCHIVED'
      : 'all';

  const archiveFilter: ArchiveFilter = explicitState
    ? stateFilter === 'all'
      ? archiveParam === 'archived' || archiveParam === 'all'
        ? archiveParam
        : 'active'
      : stateFilter === 'ARCHIVED'
      ? 'archived'
      : 'active'
    : archiveParam === 'archived' || archiveParam === 'all'
      ? archiveParam
      : 'active';

  return {
    query,
    journeyFilter,
    stageFilter,
    stateFilter,
    archiveFilter,
  };
}

export function buildContactsById(contacts: Contact[]): Map<string, Contact> {
  const map = new Map<string, Contact>();
  for (const contact of contacts) map.set(contact.id, contact);
  return map;
}

export function filterProjectsForIndex(
  projects: Project[],
  contactsById: Map<string, Contact>,
  filters: ProjectsIndexFilters,
): Project[] {
  const rawNeedle = filters.query.trim();
  const needle = rawNeedle.toLowerCase();
  const phoneNeedle = normalizePhone(rawNeedle);

  return projects.filter((project) => {
    const isArchived = Boolean(project.isArchived);
    if (filters.archiveFilter === 'active' && isArchived) return false;
    if (filters.archiveFilter === 'archived' && !isArchived) return false;

    if (filters.stageFilter !== 'all' && (project.status ?? 'NEW') !== filters.stageFilter) return false;

    if (filters.journeyFilter !== 'all') {
      const stage = normalizePipelineStageKey(project.status ?? 'NEW');
      const journey = resolveProjectJourney(stage);
      if (journey.phase !== filters.journeyFilter) return false;
    }

    if (filters.stateFilter !== 'all' && project.effectiveState !== filters.stateFilter) return false;

    if (!needle) return true;

    const contact = project.contactId ? contactsById.get(project.contactId) : null;
    const contactPhone = contact?.phone ?? '';
    const projectPhone = (project as { phone?: string }).phone ?? '';
    const haystack = [
      project.projectName ?? project.name ?? '',
      project.clientName ?? '',
      contact?.displayName ?? '',
      contact?.email ?? '',
      contactPhone,
      projectPhone,
      project.region ?? '',
      project.siteAddress ?? project.address ?? '',
      project.quoteRef ?? '',
    ]
      .join(' ')
      .toLowerCase();

    if (haystack.includes(needle)) return true;

    if (phoneNeedle.length >= 3) {
      const phoneHaystack = `${normalizePhone(contactPhone)} ${normalizePhone(projectPhone)}`;
      if (phoneHaystack.includes(phoneNeedle)) return true;
    }

    return false;
  });
}
