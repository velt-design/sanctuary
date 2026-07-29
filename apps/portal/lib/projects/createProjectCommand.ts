import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { automationRunner } from '@/lib/automation/AutomationRunner';
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
    || /staff_find_contact_duplicates_v1|schema cache|function .* does not exist/i.test(candidate.message ?? '');
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
  const now = new Date().toISOString();
  const payload = {
    id: projectUuid,
    contact_id: resolvedContact.contactUuid,
    name: request.projectName,
    quote_ref: request.quoteRef || null,
    region: request.region || null,
    site_address: request.siteAddress || null,
    pipeline_stage: 'NEW',
    notes: '',
    created_at: now,
    updated_at: now,
  };

  let projectRow: Record<string, unknown>;
  let replayed = false;
  const inserted = await client.from('projects').insert(payload).select('*').single();
  if (!inserted.error && inserted.data) {
    projectRow = inserted.data as Record<string, unknown>;
  } else {
    const existing = await client.from('projects').select('*').eq('id', projectUuid).maybeSingle();
    if (existing.error) {
      throw new ProjectCreateRecoveryError();
    }
    if (!existing.data) {
      if (resolvedContact.created) {
        await compensateContactCreate(resolvedContact.contactUuid);
      }
      throw inserted.error ?? new Error('Project creation could not be confirmed.');
    }
    if (!projectMatches(existing.data as Record<string, unknown>, request, resolvedContact.contactUuid)) {
      if (resolvedContact.created) {
        await compensateContactCreate(resolvedContact.contactUuid);
      }
      throw new ProjectCreateCommandConflictError();
    }
    projectRow = existing.data as Record<string, unknown>;
    replayed = true;
  }

  const response = (setupAutomation: ProjectCreateResponse['receipt']['setupAutomation']): ProjectCreateResponse => ({
    project: mapProjectRecord(projectRow),
    contact: resolvedContact.contact,
    receipt: {
      state: 'server_confirmed',
      confirmedAt: new Date().toISOString(),
      replayed,
      createdContact: resolvedContact.created,
      setupAutomation,
    },
  });

  if (!replayed) {
    try {
      await automationRunner.runEvent({
        type: 'ui.action.project_created',
        projectId: projectUuid,
        stage: 'NEW',
        payload: { source: 'portal' },
      });
    } catch (error) {
      throw new ProjectCreateAutomationAttentionError(response('needs_attention'), error);
    }
  }

  return response(replayed ? 'not_rechecked' : 'confirmed');
}
