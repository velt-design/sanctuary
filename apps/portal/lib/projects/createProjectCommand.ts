import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { mapContactRecord } from '@/lib/contacts/contactRecord';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import type { Contact } from '@/lib/types/contact';
import { mapProjectRecord } from './projectRecord';
import type {
  ProjectCreateRequest,
  ProjectCreateResponse,
} from './createProjectContract';

type PostgrestErrorLike = {
  code?: string | null;
  message?: string | null;
};

type DuplicateRow = {
  id?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export class ProjectCreateDuplicateContactsError extends Error {
  readonly candidates: Contact[];

  constructor(candidates: Contact[]) {
    super('A contact with the same email or phone already exists.');
    this.name = 'ProjectCreateDuplicateContactsError';
    this.candidates = candidates;
  }
}

export class ProjectCreateSchemaError extends Error {
  constructor() {
    super('Project creation is temporarily unavailable while the portal database is updated.');
    this.name = 'ProjectCreateSchemaError';
  }
}

export class ProjectCreateRecoveryError extends Error {
  constructor() {
    super('Project creation could not be confirmed and cleanup could not be verified.');
    this.name = 'ProjectCreateRecoveryError';
  }
}

export class ProjectCreateCommandConflictError extends Error {
  constructor() {
    super('This creation request ID is already used for different details. Reload the form before trying again.');
    this.name = 'ProjectCreateCommandConflictError';
  }
}

export class ProjectCreateAutomationAttentionError extends Error {
  readonly response: ProjectCreateResponse;

  constructor(response: ProjectCreateResponse, cause: unknown) {
    super('The project was saved, but its initial setup automation could not be confirmed.', {
      cause,
    });
    this.name = 'ProjectCreateAutomationAttentionError';
    this.response = response;
  }
}

function isMissingFunction(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as PostgrestErrorLike;
  return candidate.code === 'PGRST202'
    || candidate.code === '42883'
    || /staff_find_contact_duplicates_v1|project_create_v2|schema cache|function .* does not exist/i.test(candidate.message ?? '');
}

function isProjectCreateConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as PostgrestErrorLike;
  return candidate.code === '40001'
    && /PROJECT_CREATION_COMMAND_CONFLICT/i.test(candidate.message ?? '');
}

function sameText(left: unknown, right: string): boolean {
  return (typeof left === 'string' ? left.trim() : '') === right.trim();
}

function contactMatches(row: Record<string, unknown>, request: Extract<ProjectCreateRequest['contact'], { kind: 'new' }>) {
  return sameText(row.name, request.displayName)
    && sameText(row.email, request.email)
    && sameText(row.phone, request.phone);
}

function projectMatches(row: Record<string, unknown>, request: ProjectCreateRequest, contactUuid: string) {
  return sameText(row.contact_id, contactUuid)
    && sameText(row.name, request.projectName)
    && sameText(row.quote_ref, request.quoteRef)
    && sameText(row.region, request.region)
    && sameText(row.site_address, request.siteAddress);
}

async function removeCreatedContactIfUnused(contactUuid: string): Promise<void> {
  const linked = await supabaseServiceRole
    .from('projects')
    .select('id')
    .eq('contact_id', contactUuid)
    .limit(1);
  if (linked.error) throw linked.error;
  if (Array.isArray(linked.data) && linked.data.length) return;
  const result = await supabaseServiceRole.from('contacts').delete().eq('id', contactUuid);
  if (result.error) throw result.error;
}

async function compensateContactCreate(contactUuid: string): Promise<void> {
  try {
    await removeCreatedContactIfUnused(contactUuid);
  } catch {
    throw new ProjectCreateRecoveryError();
  }
}

async function findDuplicateContacts(
  client: SupabaseClient,
  contact: Extract<ProjectCreateRequest['contact'], { kind: 'new' }>,
): Promise<Contact[]> {
  if (!contact.email && !contact.phone) return [];
  const result = await client.rpc('staff_find_contact_duplicates_v1', {
    p_email: contact.email || null,
    p_phone: contact.phone || null,
    p_exclude_contact_id: uuidFromAppId(contact.contactId, 'ct'),
  });
  if (result.error) {
    if (isMissingFunction(result.error)) throw new ProjectCreateSchemaError();
    throw result.error;
  }
  return (Array.isArray(result.data) ? result.data : [])
    .map((row) => mapContactRecord(row as DuplicateRow as Record<string, unknown>));
}

async function resolveContact(
  client: SupabaseClient,
  request: ProjectCreateRequest,
): Promise<{ contact: Contact; contactUuid: string; created: boolean }> {
  const contactUuid = uuidFromAppId(request.contact.contactId, 'ct');
  if (request.contact.kind === 'existing') {
    const existing = await client.from('contacts').select('*').eq('id', contactUuid).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) throw new Error('Selected contact was not found.');
    return {
      contact: mapContactRecord(existing.data as Record<string, unknown>),
      contactUuid,
      created: false,
    };
  }

  if (!request.contact.allowDuplicate) {
    const candidates = await findDuplicateContacts(client, request.contact);
    if (candidates.length) throw new ProjectCreateDuplicateContactsError(candidates);
  }

  const now = new Date().toISOString();
  const payload = {
    id: contactUuid,
    name: request.contact.displayName,
    email: request.contact.email || null,
    phone: request.contact.phone || null,
    created_at: now,
    updated_at: now,
  };
  const inserted = await client.from('contacts').insert(payload).select('*').single();
  if (!inserted.error && inserted.data) {
    return {
      contact: mapContactRecord(inserted.data as Record<string, unknown>),
      contactUuid,
      created: true,
    };
  }

  const existing = await client.from('contacts').select('*').eq('id', contactUuid).maybeSingle();
  if (existing.error) throw new ProjectCreateRecoveryError();
  if (!existing.data) throw inserted.error ?? new Error('Contact creation could not be confirmed.');
  if (!contactMatches(existing.data as Record<string, unknown>, request.contact)) {
    throw new ProjectCreateCommandConflictError();
  }
  return {
    contact: mapContactRecord(existing.data as Record<string, unknown>),
    contactUuid,
    created: false,
  };
}

export async function createProjectCommand(
  client: SupabaseClient,
  request: ProjectCreateRequest,
): Promise<ProjectCreateResponse> {
  const projectUuid = uuidFromAppId(request.projectId, 'proj');
  const resolvedContact = await resolveContact(client, request);

  const result = await client.rpc('project_create_v2', {
    p_project_id: projectUuid,
    p_contact_id: resolvedContact.contactUuid,
    p_name: request.projectName,
    p_quote_ref: request.quoteRef || null,
    p_region: request.region || null,
    p_site_address: request.siteAddress || null,
  });

  if (result.error) {
    if (resolvedContact.created) {
      await compensateContactCreate(resolvedContact.contactUuid);
    }
    if (isMissingFunction(result.error)) throw new ProjectCreateSchemaError();
    if (isProjectCreateConflict(result.error)) throw new ProjectCreateCommandConflictError();
    throw result.error;
  }

  const rawResult = Array.isArray(result.data) ? result.data[0] : result.data;
  const rpcResult = rawResult && typeof rawResult === 'object' && !Array.isArray(rawResult)
    ? rawResult as Record<string, unknown>
    : null;
  const projectRow = rpcResult?.project && typeof rpcResult.project === 'object' && !Array.isArray(rpcResult.project)
    ? rpcResult.project as Record<string, unknown>
    : null;
  const replayed = rpcResult?.replayed;
  if (!projectRow || typeof replayed !== 'boolean') {
    if (resolvedContact.created) {
      await compensateContactCreate(resolvedContact.contactUuid);
    }
    throw new ProjectCreateRecoveryError();
  }
  if (!projectMatches(projectRow, request, resolvedContact.contactUuid)) {
    if (resolvedContact.created) {
      await compensateContactCreate(resolvedContact.contactUuid);
    }
    throw new ProjectCreateCommandConflictError();
  }

  return {
    project: mapProjectRecord(projectRow),
    contact: resolvedContact.contact,
    receipt: {
      state: 'server_confirmed',
      confirmedAt: new Date().toISOString(),
      replayed,
      createdContact: resolvedContact.created,
      setupAutomation: replayed ? 'not_rechecked' : 'confirmed',
    },
  };
}
