import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import {
  PORTAL_SEARCH_GROUP_LIMIT,
  type PortalContactSearchResult,
  type PortalProjectSearchResult,
} from './portalSearchContract';

const PER_FIELD_LIMIT = PORTAL_SEARCH_GROUP_LIMIT * 2;
const PROJECT_SELECT = 'id,name,quote_ref,site_address,pipeline_stage,archived_at,contact_id,contact:contacts(id,name)';
const CONTACT_SELECT = 'id,name,email,phone,address';

type SearchRow = Record<string, unknown>;

function textValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normaliseForRanking(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('en-NZ');
}

export function escapePortalSearchPattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function fieldRank(value: string | null | undefined, query: string, fieldPriority: number): number {
  const candidate = normaliseForRanking(value);
  if (!candidate) return Number.POSITIVE_INFINITY;
  if (candidate === query) return fieldPriority;
  if (candidate.startsWith(query)) return 10 + fieldPriority;
  if (candidate.split(/\s+/).some((part) => part.startsWith(query))) return 20 + fieldPriority;
  if (candidate.includes(query)) return 30 + fieldPriority;
  return Number.POSITIVE_INFINITY;
}

function relationContactName(value: unknown): string | null {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== 'object') return null;
  return textValue((relation as SearchRow).name);
}

function mapProject(row: SearchRow): PortalProjectSearchResult | null {
  const uuid = textValue(row.id);
  const name = textValue(row.name);
  if (!uuid || !name) return null;
  const id = appIdFromUuid('proj', uuid);
  return {
    kind: 'project',
    id,
    href: `/staff/projects/${encodeURIComponent(id)}`,
    name,
    reference: textValue(row.quote_ref),
    siteAddress: textValue(row.site_address),
    contactName: relationContactName(row.contact),
    stage: normalizePipelineStageKey(textValue(row.pipeline_stage)) ?? 'new',
    archived: Boolean(textValue(row.archived_at)),
  };
}

function mapContact(row: SearchRow): PortalContactSearchResult | null {
  const uuid = textValue(row.id);
  const name = textValue(row.name);
  if (!uuid || !name) return null;
  const id = appIdFromUuid('ct', uuid);
  return {
    kind: 'contact',
    id,
    href: `/staff/contacts/${encodeURIComponent(id)}`,
    name,
    email: textValue(row.email),
    phone: textValue(row.phone),
    address: textValue(row.address),
  };
}

async function searchColumn(
  client: SupabaseClient,
  table: 'projects' | 'contacts',
  select: string,
  column: string,
  pattern: string,
): Promise<SearchRow[]> {
  const result = await client.from(table).select(select).ilike(column, pattern).limit(PER_FIELD_LIMIT);
  if (result.error) throw result.error;
  return (result.data ?? []) as unknown as SearchRow[];
}

async function projectsForContacts(
  client: SupabaseClient,
  contactIds: string[],
): Promise<SearchRow[]> {
  if (!contactIds.length) return [];
  const result = await client
    .from('projects')
    .select(PROJECT_SELECT)
    .in('contact_id', contactIds)
    .limit(PER_FIELD_LIMIT);
  if (result.error) throw result.error;
  return (result.data ?? []) as unknown as SearchRow[];
}

function uniqueMapped<T extends { id: string }>(rows: SearchRow[], map: (row: SearchRow) => T | null): T[] {
  const mapped = new Map<string, T>();
  for (const row of rows) {
    const result = map(row);
    if (result && !mapped.has(result.id)) mapped.set(result.id, result);
  }
  return Array.from(mapped.values());
}

export async function searchPortal(
  client: SupabaseClient,
  rawQuery: string,
): Promise<{ projects: PortalProjectSearchResult[]; contacts: PortalContactSearchResult[] }> {
  const query = rawQuery.trim();
  const rankedQuery = normaliseForRanking(query);
  const pattern = `%${escapePortalSearchPattern(query)}%`;

  const contactNamePromise = searchColumn(client, 'contacts', CONTACT_SELECT, 'name', pattern);
  const [
    projectNames,
    projectReferences,
    projectAddresses,
    contactNames,
    contactEmails,
    contactPhones,
    contactAddresses,
  ] = await Promise.all([
    searchColumn(client, 'projects', PROJECT_SELECT, 'name', pattern),
    searchColumn(client, 'projects', PROJECT_SELECT, 'quote_ref', pattern),
    searchColumn(client, 'projects', PROJECT_SELECT, 'site_address', pattern),
    contactNamePromise,
    searchColumn(client, 'contacts', CONTACT_SELECT, 'email', pattern),
    searchColumn(client, 'contacts', CONTACT_SELECT, 'phone', pattern),
    searchColumn(client, 'contacts', CONTACT_SELECT, 'address', pattern),
  ]);

  const linkedProjects = await projectsForContacts(
    client,
    contactNames.map((row) => textValue(row.id)).filter((id): id is string => Boolean(id)),
  );

  const projects = uniqueMapped(
    [...projectNames, ...projectReferences, ...projectAddresses, ...linkedProjects],
    mapProject,
  )
    .sort((a, b) => {
      const aRank = Math.min(
        fieldRank(a.name, rankedQuery, 0),
        fieldRank(a.reference, rankedQuery, 1),
        fieldRank(a.siteAddress, rankedQuery, 2),
        fieldRank(a.contactName, rankedQuery, 3),
      );
      const bRank = Math.min(
        fieldRank(b.name, rankedQuery, 0),
        fieldRank(b.reference, rankedQuery, 1),
        fieldRank(b.siteAddress, rankedQuery, 2),
        fieldRank(b.contactName, rankedQuery, 3),
      );
      return aRank - bRank || a.name.localeCompare(b.name, 'en-NZ', { sensitivity: 'base' });
    })
    .slice(0, PORTAL_SEARCH_GROUP_LIMIT);

  const contacts = uniqueMapped(
    [...contactNames, ...contactEmails, ...contactPhones, ...contactAddresses],
    mapContact,
  )
    .sort((a, b) => {
      const aRank = Math.min(
        fieldRank(a.name, rankedQuery, 0),
        fieldRank(a.email, rankedQuery, 1),
        fieldRank(a.phone, rankedQuery, 2),
        fieldRank(a.address, rankedQuery, 3),
      );
      const bRank = Math.min(
        fieldRank(b.name, rankedQuery, 0),
        fieldRank(b.email, rankedQuery, 1),
        fieldRank(b.phone, rankedQuery, 2),
        fieldRank(b.address, rankedQuery, 3),
      );
      return aRank - bRank || a.name.localeCompare(b.name, 'en-NZ', { sensitivity: 'base' });
    })
    .slice(0, PORTAL_SEARCH_GROUP_LIMIT);

  return { projects, contacts };
}
