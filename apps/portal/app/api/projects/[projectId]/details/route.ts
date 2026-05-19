import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

type AnyRecord = Record<string, any>;

function hasOwn(obj: unknown, key: string): boolean {
  return Boolean(obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key));
}

function readStringField(obj: AnyRecord, keys: string[]): { has: boolean; value: string } {
  for (const key of keys) {
    if (hasOwn(obj, key)) {
      const raw = obj[key];
      if (raw == null) return { has: true, value: '' };
      return { has: true, value: String(raw).trim() };
    }
  }
  return { has: false, value: '' };
}

function readDateField(obj: AnyRecord, keys: string[]): { has: boolean; value: string | null; valid: boolean } {
  const { has, value } = readStringField(obj, keys);
  if (!has) return { has: false, value: null, valid: true };
  if (!value) return { has: true, value: null, valid: true };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { has: true, value, valid: true };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return { has: true, value: null, valid: false };
  return { has: true, value: parsed.toISOString(), valid: true };
}

async function updateWithUnknownColumnRetry(
  supabase: SupabaseClient,
  table: string,
  match: Record<string, any>,
  payloadIn: Record<string, any>,
): Promise<{ data: any | null; error: any | null }> {
  const payload = { ...payloadIn };
  if (!Object.keys(payload).length) return { data: null, error: null };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const res = await supabase.from(table).update(payload as any).match(match).select('*').single();
    if (!res.error && res.data) return { data: res.data, error: null };

    const missing = missingColumnFromError(res.error);
    if (missing && missing in payload) {
      delete payload[missing];
      if (!Object.keys(payload).length) return { data: null, error: null };
      continue;
    }

    return { data: null, error: res.error };
  }

  return { data: null, error: { message: 'Supabase update failed after retries', code: 'CLIENT_RETRY' } };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid project id', 400);
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};
  const projectBody: AnyRecord =
    body && typeof body.project === 'object' && body.project !== null && !Array.isArray(body.project) ? body.project : {};
  const contactBody: AnyRecord =
    body && typeof body.contact === 'object' && body.contact !== null && !Array.isArray(body.contact) ? body.contact : {};
  const contactIdRaw = typeof body?.contactId === 'string' ? body.contactId : null;

  const projectRes = await supabase.from('projects').select('id, contact_id').eq('id', projectUuid).maybeSingle();
  if (projectRes.error || !projectRes.data) return jsonError('Project not found', 404);
  const projectRow: any = projectRes.data;

  let contactUuid: string | null = null;
  if (contactIdRaw) {
    try {
      contactUuid = uuidFromAppId(contactIdRaw, 'ct');
    } catch {
      contactUuid = null;
    }
  }
  if (!contactUuid && typeof projectRow?.contact_id === 'string') {
    contactUuid = projectRow.contact_id;
  }

  const projectPatch: Record<string, any> = {};
  const nameField = readStringField(projectBody, ['name', 'projectName', 'project_name']);
  if (nameField.has) {
    if (!nameField.value) return jsonError('Project name is required', 400);
    projectPatch.name = nameField.value;
  }

  const siteAddressField = readStringField(projectBody, ['siteAddress', 'site_address', 'address']);
  if (siteAddressField.has) projectPatch.site_address = siteAddressField.value || null;

  const regionField = readStringField(projectBody, ['region']);
  if (regionField.has) projectPatch.region = regionField.value || null;

  const quoteRefField = readStringField(projectBody, ['quoteRef', 'quote_ref']);
  if (quoteRefField.has) projectPatch.quote_ref = quoteRefField.value || null;

  const nextActionField = readDateField(projectBody, ['nextActionDate', 'next_action_date', 'followUpDate', 'follow_up_date']);
  if (nextActionField.has) {
    if (!nextActionField.valid) return jsonError('Invalid nextActionDate (expected YYYY-MM-DD)', 400);
    projectPatch.follow_up_date = nextActionField.value;
    projectPatch.next_action_date = nextActionField.value;
  }

  const archivedField = readDateField(projectBody, ['archivedAt', 'archived_at']);
  // Track that archived_at was REQUESTED so we can detect the silent
  // column-drop path. `updateWithUnknownColumnRetry` strips unknown
  // columns and retries -- great for forward-compat, but it means an
  // archive request against a DB missing the `archived_at` column
  // returns 200 OK without writing anything. We check after the update
  // and fail loudly so the UI surfaces "schema not migrated" instead
  // of a misleading success toast.
  const archivedAtRequested = archivedField.has;
  if (archivedField.has) {
    if (!archivedField.valid) return jsonError('Invalid archivedAt (expected ISO date)', 400);
    projectPatch.archived_at = archivedField.value;
  }

  const contactNameField = readStringField(contactBody, ['name', 'contactName', 'contact_name']);
  const contactEmailField = readStringField(contactBody, ['email', 'contactEmail', 'contact_email']);
  const contactPhoneField = readStringField(contactBody, ['phone', 'contactPhone', 'contact_phone']);
  const hasContactFields = contactNameField.has || contactEmailField.has || contactPhoneField.has;

  if (contactUuid && hasContactFields && contactNameField.has && !contactNameField.value) {
    return jsonError('Contact name is required', 400);
  }

  if (!contactUuid && hasContactFields) {
    if (contactNameField.has) projectPatch.contact_name = contactNameField.value || null;
    if (contactEmailField.has) projectPatch.contact_email = contactEmailField.value || null;
    if (contactPhoneField.has) projectPatch.contact_phone = contactPhoneField.value || null;
  }

  const nowIso = new Date().toISOString();
  if (Object.keys(projectPatch).length) projectPatch.updated_at = nowIso;

  const { data: updatedProject, error: projectError } = await updateWithUnknownColumnRetry(supabase, 'projects', { id: projectUuid }, projectPatch);
  if (projectError) return jsonError(projectError.message ?? 'Failed to update project details', 500);

  // Silent-drop guard: if archive was requested but the row came back
  // without archived_at reflected, the column is missing from this DB.
  // Tell the caller plainly so the UI can surface "apply migrations"
  // instead of pretending it worked.
  //
  // Comparison parses both sides as instants because Postgres normalises
  // the ISO format on round-trip (`...000Z` -> `...+00:00`), so a naive
  // string equality check would always fail.
  if (archivedAtRequested) {
    const row = (updatedProject ?? {}) as Record<string, unknown>;
    const hasArchivedAtKey = Object.prototype.hasOwnProperty.call(row, 'archived_at');
    const writtenRaw = hasArchivedAtKey ? row.archived_at : undefined;
    const expected = archivedField.value;

    const expectedMs = expected === null ? null : Date.parse(expected);
    const writtenMs =
      writtenRaw === null || writtenRaw === undefined
        ? null
        : typeof writtenRaw === 'string'
          ? Date.parse(writtenRaw)
          : Number.NaN;

    const matches =
      !hasArchivedAtKey
        ? false
        : expectedMs === null
          ? writtenMs === null
          : writtenMs !== null && !Number.isNaN(writtenMs) && Math.abs(writtenMs - expectedMs) < 1000;

    if (!hasArchivedAtKey) {
      return jsonError(
        'Archive failed: projects.archived_at column missing or not writable. Apply supabase/migrations/20260208_000002_project_archive.sql.',
        500,
      );
    }
    if (!matches) {
      return jsonError(
        `Archive failed: archived_at write did not persist (expected ${expected ?? 'null'}, got ${writtenRaw === undefined ? 'undefined' : JSON.stringify(writtenRaw)}). Check row-level security policies on projects.archived_at.`,
        500,
      );
    }
  }

  let updatedContact: any = null;
  if (contactUuid && hasContactFields) {
    const contactPatch: Record<string, any> = {};
    if (contactNameField.has && contactNameField.value) contactPatch.name = contactNameField.value;
    if (contactEmailField.has) contactPatch.email = contactEmailField.value || null;
    if (contactPhoneField.has) contactPatch.phone = contactPhoneField.value || null;
    if (Object.keys(contactPatch).length) contactPatch.updated_at = nowIso;

    const contactRes = await updateWithUnknownColumnRetry(supabase, 'contacts', { id: contactUuid }, contactPatch);
    if (contactRes.error) return jsonError(contactRes.error.message ?? 'Failed to update contact', 500);
    updatedContact = contactRes.data;
  }

  return jsonOk({ project: updatedProject ?? projectRow, contact: updatedContact });
}
