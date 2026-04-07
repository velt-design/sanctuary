import type { Contact } from '@/lib/types/contact';
import { newId } from '@/lib/utils/id';
import { nowIso } from '@/lib/utils/time';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { getSupabaseBrowser, supabaseHostFromUrl, supabaseRestUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { SupabaseRepoError, type PostgrestErrorLike } from '@/lib/supabase/repoError';
import { formatSupportedSchemaMessage } from '@/lib/supabase/schemaGuard';

function sortContacts(contacts: Contact[]): Contact[] {
  return contacts
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
}

function upsertContactInList(list: Contact[], contact: Contact): Contact[] {
  const next = list.filter((c) => c.id !== contact.id);
  next.push(contact);
  return sortContacts(next);
}

function toPostgrestError(value: unknown): PostgrestErrorLike | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as any;
  return {
    message: v.message,
    code: v.code,
    details: v.details,
    hint: v.hint,
  };
}

function hostSuffix(): string {
  const host = supabaseHostFromUrl(supabaseRuntimeUrl());
  return host ? ` (host: ${host})` : '';
}

function wrapError(table: string, error: unknown): SupabaseRepoError {
  const supabaseUrl = supabaseRuntimeUrl();
  const supabaseHost = supabaseHostFromUrl(supabaseUrl);
  const postgrestUrl = supabaseRestUrl(table);
  const postgrestHost = supabaseHostFromUrl(postgrestUrl);
  const pg = toPostgrestError(error);
  const code = typeof pg?.code === 'string' && pg.code.trim() ? pg.code.trim() : '';
  const msg = typeof pg?.message === 'string' && pg.message.trim() ? pg.message.trim() : 'Supabase request failed';
  const schemaMessage = formatSupportedSchemaMessage(table, error);
  const message = schemaMessage ?? `Supabase ${code ? `${code}: ` : ''}${msg}${hostSuffix()}`;
  return new SupabaseRepoError(message, {
    table,
    supabaseUrl,
    supabaseHost,
    postgrestUrl,
    postgrestHost,
    postgrestError: pg,
  });
}

export async function listContacts(): Promise<Contact[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.from('contacts').select('*').order('name', { ascending: true });
  if (error) throw wrapError('contacts', error);

  const contacts: Contact[] = (Array.isArray(data) ? data : []).map((row: any) => {
    const id = typeof row?.id === 'string' ? row.id : '';
    const createdAt = typeof row?.created_at === 'string' ? row.created_at : nowIso();
    const updatedAt = typeof row?.updated_at === 'string' ? row.updated_at : createdAt;
    const email = typeof row?.email === 'string' ? row.email : '';
    const phone = typeof row?.phone === 'string' ? row.phone : '';
    const name = typeof row?.name === 'string' ? row.name : '';

    return {
      id: appIdFromUuid('ct', id),
      displayName: name.trim(),
      email,
      phone,
      createdAt,
      updatedAt,
    };
  });

  return sortContacts(contacts);
}

export async function getContact(id: string): Promise<Contact | null> {
  try {
    const supabase = getSupabaseBrowser();
    const uuid = uuidFromAppId(id, 'ct');
    const { data, error } = await supabase.from('contacts').select('*').eq('id', uuid).single();
    if (error || !data) return null;

    const createdAt = typeof (data as any)?.created_at === 'string' ? (data as any).created_at : nowIso();
    const updatedAt = typeof (data as any)?.updated_at === 'string' ? (data as any).updated_at : createdAt;
    const name = typeof (data as any)?.name === 'string' ? (data as any).name : '';

    return {
      id: appIdFromUuid('ct', (data as any).id),
      displayName: name.trim(),
      email: typeof (data as any)?.email === 'string' ? (data as any).email : '',
      phone: typeof (data as any)?.phone === 'string' ? (data as any).phone : '',
      createdAt,
      updatedAt,
    };
  } catch {
    return null;
  }
}

export async function createContact(data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Contact> {
  const now = nowIso();
  const contact: Contact = {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : newId('ct'),
    createdAt: now,
    updatedAt: now,
    displayName: data.displayName,
    email: data.email,
    phone: data.phone,
  };

  await upsertContact(contact);
  const created = await getContact(contact.id);
  if (!created) throw new Error(`Contact was created but could not be fetched${hostSuffix()}`);
  return created;
}

export async function updateContact(id: string, patch: Partial<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Contact> {
  const supabase = getSupabaseBrowser();
  const uuid = uuidFromAppId(id, 'ct');
  const now = nowIso();

  const nextDisplayName = typeof patch.displayName === 'string' ? patch.displayName.trim() : undefined;

  const payload: any = {
    ...(typeof nextDisplayName === 'string' ? { name: nextDisplayName } : null),
    ...(typeof patch.email === 'string' ? { email: patch.email.trim() || null } : null),
    ...(typeof patch.phone === 'string' ? { phone: patch.phone.trim() || null } : null),
    ...(typeof (patch as any).address === 'string' ? { address: (patch as any).address.trim() || null } : null),
    updated_at: now,
  };

  const { data, error } = await updateWithUnknownColumnRetry(supabase, uuid, payload);
  if (error || !data) throw wrapError('contacts', error);

  const createdAt = typeof (data as any)?.created_at === 'string' ? (data as any).created_at : now;
  const updatedAt = typeof (data as any)?.updated_at === 'string' ? (data as any).updated_at : now;
  const name = typeof (data as any)?.name === 'string' ? (data as any).name : nextDisplayName ?? '';

  const updated: Contact = {
    id: appIdFromUuid('ct', (data as any).id),
    displayName: name.trim(),
    email: typeof (data as any)?.email === 'string' ? (data as any).email : typeof patch.email === 'string' ? patch.email.trim() : '',
    phone: typeof (data as any)?.phone === 'string' ? (data as any).phone : typeof patch.phone === 'string' ? patch.phone.trim() : '',
    createdAt,
    updatedAt,
  };

  return updated;
}

export async function upsertContact(contact: Contact): Promise<void> {
  const supabase = getSupabaseBrowser();
  const now = nowIso();
  const uuid = uuidFromAppId(contact.id, 'ct');

  const insertPayload: any = {
    id: uuid,
    name: contact.displayName.trim(),
    email: typeof contact.email === 'string' ? contact.email.trim() || null : null,
    phone: typeof contact.phone === 'string' ? contact.phone.trim() || null : null,
    address: (contact as any).address ? String((contact as any).address).trim() || null : null,
    created_at: typeof contact.createdAt === 'string' && contact.createdAt.trim() ? contact.createdAt.trim() : now,
    updated_at: now,
  };

  const { error } = await insertWithUnknownColumnRetry(supabase, insertPayload);
  if (!error) return;

  const pg = toPostgrestError(error);
  const code = typeof pg?.code === 'string' ? pg.code : '';
  if (code !== '23505') throw wrapError('contacts', error);

  // On conflict, update only mutable columns.
  const updatePayload: any = { ...insertPayload };
  delete updatePayload.id;
  delete updatePayload.created_at;

  const { error: updateError } = await updateWithUnknownColumnRetry(supabase, uuid, updatePayload).then((r) => ({ error: r.error }));
  if (updateError) throw wrapError('contacts', updateError);
}

async function insertWithUnknownColumnRetry(
  supabase: ReturnType<typeof getSupabaseBrowser>,
  payloadIn: Record<string, any>,
): Promise<{ error: any | null }> {
  const payload = { ...payloadIn };
  const { error } = await supabase.from('contacts').insert(payload).select('id').single();
  if (!error) return { error: null };
  return { error };
}

async function updateWithUnknownColumnRetry(
  supabase: ReturnType<typeof getSupabaseBrowser>,
  uuid: string,
  payloadIn: Record<string, any>,
): Promise<{ data: any | null; error: any | null }> {
  const payload = { ...payloadIn };
  const { data, error } = await supabase.from('contacts').update(payload).eq('id', uuid).select('*').single();
  if (!error && data) return { data, error: null };
  return { data: null, error };
}
