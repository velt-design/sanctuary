import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { normalizeProjectStatus } from '@/lib/types/project';

export type ArchiveFilter = 'active' | 'archived' | 'all';

export type ProjectsIndexFilters = {
  query: string;
  statusFilter: Project['status'] | 'all';
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

export function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D+/g, '');
}

export function parseProjectsIndexFilters(searchParams: SearchParamSource): ProjectsIndexFilters {
  const statusParam = readParam(searchParams, 'status').trim();
  const query = readParam(searchParams, 'q').trim();
  const archiveParam = readParam(searchParams, 'archive').trim().toLowerCase();

  const statusFilter =
    !statusParam || statusParam.toLowerCase() === 'all'
      ? 'all'
      : (normalizeProjectStatus(statusParam).status ?? 'all');

  const archiveFilter: ArchiveFilter =
    archiveParam === 'archived' || archiveParam === 'all' ? archiveParam : 'active';

  return {
    query,
    statusFilter,
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

    if (filters.statusFilter !== 'all' && (project.status ?? 'NEW') !== filters.statusFilter) return false;

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
