import { formatSupportedSchemaMessage } from '@/lib/supabase/schemaGuard';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
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

export async function createContactWithRetry(payloadIn: Record<string, any>, supabase?: SupabaseClient) {
  const client = supabase ?? (await getSupabaseServerAuth());
  const payload = { ...payloadIn };
  const res = await client.from('contacts').insert(payload).select('*').single();
  if (!res.error && res.data) return res;

  return {
    data: null,
    error: res.error
      ? {
          ...res.error,
          message: formatSupportedSchemaMessage('contacts', res.error) ?? res.error.message,
        }
      : { message: 'Failed to create contact' },
  };
}

export async function updateContactWithRetry(contactUuid: string, payloadIn: Record<string, any>, supabase?: SupabaseClient) {
  const client = supabase ?? (await getSupabaseServerAuth());
  const payload = { ...payloadIn };
  if (!Object.keys(payload).length) return { data: null, error: null };
  const res = await client.from('contacts').update(payload).eq('id', contactUuid).select('*').single();
  if (!res.error && res.data) return res;

  return {
    data: null,
    error: res.error
      ? {
          ...res.error,
          message: formatSupportedSchemaMessage('contacts', res.error) ?? res.error.message,
        }
      : { message: 'Failed to update contact' },
  };
}
