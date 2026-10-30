import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import type { ProjectSiteAddress, SiteAddressSelection } from './siteAddressContract';
import { SiteAddressError, type SiteAddressProvider } from './siteAddressProvider.server';

type ProjectAddressRow = { id: string; site_address: string | null; updated_at: string };
const columns = 'id,site_address,updated_at';
function row(value: unknown, projectUuid: string): ProjectAddressRow {
  const candidate = value as ProjectAddressRow | null;
  if (!candidate || candidate.id !== projectUuid || (candidate.site_address !== null && typeof candidate.site_address !== 'string')
    || typeof candidate.updated_at !== 'string' || !Number.isFinite(Date.parse(candidate.updated_at))) {
    throw new SiteAddressError('The current project address could not be confirmed. Retry project address.');
  }
  return candidate;
}
export function projectSiteAddress(value: ProjectAddressRow): ProjectSiteAddress {
  return { projectId: appIdFromUuid('proj', value.id), address: value.site_address ?? '', updatedAt: value.updated_at };
}

/** Caller/RLS access is checked for every request, before any external request. */
export async function readProjectSiteAddress(client: SupabaseClient, projectUuid: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const result = await client.from('projects').select(columns).eq('id', projectUuid).abortSignal(signal).maybeSingle();
  signal.throwIfAborted();
  if (result.error) throw new SiteAddressError('The project address could not be loaded. Retry project address.');
  if (!result.data) throw new SiteAddressError('Project not found', 404, 'PROJECT_NOT_FOUND');
  return row(result.data, projectUuid);
}

/** No metadata or schema extension: the canonical Project string remains the only durable address owner. */
export async function selectProjectSiteAddress(client: SupabaseClient, current: ProjectAddressRow,
  selection: SiteAddressSelection, provider: SiteAddressProvider, signal: AbortSignal) {
  if (current.updated_at !== selection.expectedUpdatedAt && current.site_address !== selection.address) {
    throw new SiteAddressError('The project changed. Reload the current address, then choose again.', 409, 'ADDRESS_CHANGED');
  }
  signal.throwIfAborted();
  const confirmed = await provider.validateSelection(selection, signal);
  signal.throwIfAborted();
  if (confirmed !== selection.address) throw new SiteAddressError('The selected address needs a correction. Search and choose the corrected address.', 422, 'ADDRESS_NOT_CONFIRMED');
  // An interrupted response can be reconciled by validating the same selected text, without another write.
  if (current.site_address === confirmed) {
    const rechecked = await readProjectSiteAddress(client, current.id, signal);
    if (rechecked.site_address !== confirmed) throw new SiteAddressError('The project changed during address confirmation. Reload the current address, then choose again.', 409, 'ADDRESS_CHANGED');
    return projectSiteAddress(rechecked);
  }
  const updatedAt = new Date(Math.max(Date.now(), Date.parse(current.updated_at) + 1)).toISOString();
  const result = await client.from('projects').update({ site_address: confirmed, updated_at: updatedAt })
    .eq('id', current.id).eq('updated_at', current.updated_at).select(columns).abortSignal(signal).maybeSingle();
  signal.throwIfAborted();
  if (result.error) throw new SiteAddressError('The selected address save could not be confirmed. Retry the same selection.');
  if (!result.data) throw new SiteAddressError('The project changed while the address was being checked. Reload the current address, then choose again.', 409, 'ADDRESS_CHANGED');
  const written = row(result.data, current.id);
  // The normal Project trigger owns updated_at. Its valid returned revision,
  // not the caller's offered timestamp, acknowledges this exact scoped CAS.
  if (written.site_address !== confirmed) {
    throw new SiteAddressError('The selected address save could not be confirmed. Retry the same selection.');
  }
  return projectSiteAddress(written);
}
