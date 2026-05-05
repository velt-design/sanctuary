import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { portalTodayYmd } from '@/lib/format/portalDateTime';
import { normalizeProjectStatus } from '@/lib/types/project';

export type DueFilter = 'all' | 'due' | 'overdue' | 'today';
export type ArchiveFilter = 'active' | 'archived' | 'all';

export type ProjectsIndexFilters = {
  query: string;
  statusFilter: Project['status'] | 'all';
  dueFilter: DueFilter;
  archiveFilter: ArchiveFilter;
};

type SearchParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function readFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return typeof value === 'string' ? value : '';
}

function readParam(source: SearchParamSource, key: string): string {
  if (typeof (source as URLSearchParams).get === 'function') return (source as URLSearchParams).get(key) ?? '';
  return readFirst((source as Record<string, string | string[] | undefined>)[key]);
}

export function toYmd(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function todayYmd(now: Date | string | number = new Date()): string {
  return portalTodayYmd(now);
}

export function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D+/g, '');
}

export function parseProjectsIndexFilters(searchParams: SearchParamSource): ProjectsIndexFilters {
  const statusParam = readParam(searchParams, 'status').trim();
  const query = readParam(searchParams, 'q').trim();
  const dueParam = readParam(searchParams, 'due').trim().toLowerCase();
  const dueFlag = readParam(searchParams, 'nextActionDue').trim().toLowerCase();
  const archiveParam = readParam(searchParams, 'archive').trim().toLowerCase();

  const statusFilter =
    !statusParam || statusParam.toLowerCase() === 'all'
      ? 'all'
      : (normalizeProjectStatus(statusParam).status ?? 'all');

  let dueFilter: DueFilter = 'all';
  if (dueParam === 'overdue' || dueParam === 'today') {
    dueFilter = dueParam;
  } else if (['1', 'true', 'yes', 'y'].includes(dueFlag) || dueParam === 'due') {
    dueFilter = 'due';
  }

  const archiveFilter: ArchiveFilter =
    archiveParam === 'archived' || archiveParam === 'all' ? archiveParam : 'active';

  return {
    query,
    statusFilter,
    dueFilter,
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
  nowYmd: string,
): Project[] {
  const rawNeedle = filters.query.trim();
  const needle = rawNeedle.toLowerCase();
  const phoneNeedle = normalizePhone(rawNeedle);

  return projects.filter((project) => {
    const isArchived = Boolean(project.isArchived);
    if (filters.archiveFilter === 'active' && isArchived) return false;
    if (filters.archiveFilter === 'archived' && !isArchived) return false;

    if (filters.statusFilter !== 'all' && (project.status ?? 'NEW') !== filters.statusFilter) return false;

    const nextAction = toYmd(project.nextActionDate ?? project.followUpDate);
    if (filters.dueFilter !== 'all') {
      if (!nextAction) return false;
      if (filters.dueFilter === 'due' && nextAction > nowYmd) return false;
      if (filters.dueFilter === 'overdue' && nextAction >= nowYmd) return false;
      if (filters.dueFilter === 'today' && nextAction !== nowYmd) return false;
    }

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
