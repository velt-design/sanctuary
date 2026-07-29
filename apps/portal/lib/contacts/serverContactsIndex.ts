import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { mapContactRecord } from './contactRecord';
import type {
  ContactsIndexParams,
  ContactsIndexResponse,
} from './contactsIndexContract';

type RpcPayload = {
  rows?: unknown;
  totalCount?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

export class ContactsIndexSchemaError extends Error {
  constructor() {
    super('Contacts search is temporarily unavailable while the portal database is updated.');
    this.name = 'ContactsIndexSchemaError';
  }
}

function isMissingFunction(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return code === 'PGRST202'
    || code === '42883'
    || /staff_contacts_index_v1|schema cache|function .* does not exist/i.test(message);
}

function readPayload(value: unknown): RpcPayload {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RpcPayload
    : {};
}

function finiteInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;
}

export async function loadContactsIndexData(
  params: ContactsIndexParams,
  supabase?: SupabaseClient,
): Promise<ContactsIndexResponse['contacts']> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const result = await client.rpc('staff_contacts_index_v1', {
    p_search: params.search,
    p_page: params.page,
    p_page_size: params.pageSize,
    p_sort: params.sort,
  });
  if (result.error) {
    if (isMissingFunction(result.error)) throw new ContactsIndexSchemaError();
    throw result.error;
  }

  const payload = readPayload(result.data);
  const rows = (Array.isArray(payload.rows) ? payload.rows : [])
    .map((row) => mapContactRecord(row as Record<string, unknown>));
  const totalCount = finiteInteger(payload.totalCount, rows.length);
  const page = Math.max(1, finiteInteger(payload.page, params.page));
  const pageSize = params.pageSize;
  return {
    rows,
    totalCount,
    truncated: false,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}
