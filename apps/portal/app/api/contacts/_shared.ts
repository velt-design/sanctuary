import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { supabaseServer } from '@/lib/supabaseClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';

type AnyRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function readString(value: unknown): string | null {
  if (value == null) return null;
  return String(value).trim();
}

export function mapContact(row: AnyRecord) {
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

export async function createContactWithRetry(payloadIn: Record<string, any>) {
  const payload = { ...payloadIn };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await supabaseServer.from('contacts').insert(payload).select('*').single();
    if (!res.error && res.data) return res;

    const missing = missingColumnFromError(res.error);
    if (missing && missing in payload) {
      delete payload[missing];
      continue;
    }

    return res;
  }

  return { data: null, error: { message: 'Supabase insert failed after retries', code: 'CLIENT_RETRY' } };
}

export async function updateContactWithRetry(contactUuid: string, payloadIn: Record<string, any>) {
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
