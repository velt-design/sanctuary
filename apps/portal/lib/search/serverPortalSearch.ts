import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import {
  PORTAL_SEARCH_GROUP_LIMIT,
  type PortalContactSearchResult,
  type PortalProjectSearchResult,
} from './portalSearchContract';

type PortalSearchRpcRow = {
  access_granted?: unknown;
  entity_kind?: unknown;
  entity_id?: unknown;
  name?: unknown;
  reference?: unknown;
  site_address?: unknown;
  contact_name?: unknown;
  pipeline_stage?: unknown;
  archived_at?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
};

export class PortalSearchAccessError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403) {
    super(status === 401 ? 'Unauthorized' : 'Forbidden');
    this.name = 'PortalSearchAccessError';
    this.status = status;
  }
}

function isUnauthenticatedRpcError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  return code === 'PGRST301'
    || code === 'PGRST302'
    || (code === '42501' && message.includes('portal_search_v1'));
}

function textValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function mapProject(row: PortalSearchRpcRow): PortalProjectSearchResult | null {
  if (row.entity_kind !== 'project') return null;
  const uuid = textValue(row.entity_id);
  const name = textValue(row.name);
  if (!uuid || !name) return null;
  const id = appIdFromUuid('proj', uuid);
  return {
    kind: 'project',
    id,
    href: `/staff/projects/${encodeURIComponent(id)}`,
    name,
    reference: textValue(row.reference),
    siteAddress: textValue(row.site_address),
    contactName: textValue(row.contact_name),
    stage: normalizePipelineStageKey(textValue(row.pipeline_stage)) ?? 'new',
    archived: Boolean(textValue(row.archived_at)),
  };
}

function mapContact(row: PortalSearchRpcRow): PortalContactSearchResult | null {
  if (row.entity_kind !== 'contact') return null;
  const uuid = textValue(row.entity_id);
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

function uniqueBounded<T extends { id: string }>(items: Array<T | null>): T[] {
  const unique = new Map<string, T>();
  for (const item of items) {
    if (item && !unique.has(item.id)) unique.set(item.id, item);
    if (unique.size === PORTAL_SEARCH_GROUP_LIMIT) break;
  }
  return Array.from(unique.values());
}

export async function searchPortal(
  client: SupabaseClient,
  rawQuery: string,
): Promise<{ projects: PortalProjectSearchResult[]; contacts: PortalContactSearchResult[] }> {
  const query = rawQuery.trim();
  const result = await client.rpc('portal_search_v1', {
    search_query: query,
    result_limit: PORTAL_SEARCH_GROUP_LIMIT,
  });
  if (result.error) {
    if (isUnauthenticatedRpcError(result.error)) throw new PortalSearchAccessError(401);
    throw result.error;
  }

  const rows = Array.isArray(result.data) ? result.data as PortalSearchRpcRow[] : [];
  const accessRow = rows.find((row) => row.entity_kind == null);
  if (!accessRow) throw new Error('portal_search_v1 did not return its access result');
  if (accessRow.access_granted !== true) throw new PortalSearchAccessError(403);
  return {
    projects: uniqueBounded(rows.map(mapProject)),
    contacts: uniqueBounded(rows.map(mapContact)),
  };
}

// This intentionally avoids the general staff API auth helper's two preliminary
// provider calls. The single SECURITY INVOKER RPC verifies portal membership and
// performs the RLS-protected read using this request's cookie-bound access token.
export async function searchPortalForRequest(rawQuery: string) {
  return searchPortal(await getSupabaseServerAuth(), rawQuery);
}
