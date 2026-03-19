import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { supabaseServer } from '@/lib/supabaseClient';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (value == null) return null;
  return String(value).trim();
}

async function updateContactWithRetry(contactUuid: string, payloadIn: Record<string, any>) {
  const payload = { ...payloadIn };
  if (!Object.keys(payload).length) return { data: null, error: null };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await supabaseServer.from('contacts').update(payload).eq('id', contactUuid).select('*').single();
    if (!res.error && res.data) return res;

    const missing = missingColumnFromError(res.error);
    if (missing && missing in payload) {
      delete payload[missing];
      if (!Object.keys(payload).length) return { data: null, error: null };
      continue;
    }

    return res;
  }

  return { data: null, error: { message: 'Supabase update failed after retries', code: 'CLIENT_RETRY' } };
}

function mapContact(row: AnyRecord) {
  const createdAt = typeof row.created_at === 'string' ? row.created_at : new Date().toISOString();
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : createdAt;
  return {
    id: appIdFromUuid('ct', String(row.id ?? '')),
    displayName: typeof row.name === 'string' ? row.name.trim() : '',
    email: typeof row.email === 'string' ? row.email : '',
    phone: typeof row.phone === 'string' ? row.phone : '',
    createdAt,
    updatedAt,
  };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  let contactUuid: string;
  try {
    const { contactId } = await ctx.params;
    contactUuid = uuidFromAppId(contactId, 'ct');
  } catch {
    return jsonError('Invalid contactId', 400);
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = isRecord(parsed.body) ? parsed.body : {};

  const displayName = readString(body.displayName);
  const email = readString(body.email);
  const phone = readString(body.phone);

  if (displayName !== null && !displayName) {
    return jsonError('Contact name is required', 400);
  }

  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (displayName !== null) patch.name = displayName;
  if (email !== null) patch.email = email || null;
  if (phone !== null) patch.phone = phone || null;

  const updateRes = await updateContactWithRetry(contactUuid, patch);
  if (updateRes.error || !updateRes.data) {
    const message = updateRes.error?.message ?? 'Failed to update contact';
    if (typeof message === 'string' && message.toLowerCase().includes('not found')) {
      return jsonError('Contact not found', 404);
    }
    return jsonError(message, 500);
  }

  return jsonOk({ contact: mapContact(updateRes.data as AnyRecord) });
}
