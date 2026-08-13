import { createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { createContactWithRetry, isRecord, mapContact, readString } from './_shared';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/contacts');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = isRecord(parsed.body) ? parsed.body : {};

  const displayName = readString(body.displayName);
  const email = readString(body.email);
  const phone = readString(body.phone);
  const contactId = readString(body.contactId);

  if (!displayName) {
    return jsonError('Contact name is required', 400, diagnostics);
  }

  let contactUuid: string | null = null;
  if (contactId) {
    try {
      contactUuid = uuidFromAppId(contactId, 'ct');
    } catch {
      return jsonError('Invalid contact id', 400, diagnostics);
    }
  }

  const now = new Date().toISOString();
  const createRes = await createContactWithRetry(
    {
      ...(contactUuid ? { id: contactUuid } : {}),
      name: displayName,
      email: email || null,
      phone: phone || null,
      created_at: now,
      updated_at: now,
    },
    auth.supabase,
  );

  if (createRes.error || !createRes.data) {
    if (contactUuid && createRes.error && 'code' in createRes.error && createRes.error.code === '23505') {
      const existing = await auth.supabase.from('contacts').select('*').eq('id', contactUuid).maybeSingle();
      if (!existing.error && existing.data) {
        return jsonOk({ contact: mapContact(existing.data), replayed: true }, 200, diagnostics);
      }
    }
    const message = createRes.error?.message ?? 'Failed to create contact';
    return jsonError(message, 500, diagnostics);
  }

  return jsonOk({ contact: mapContact(createRes.data), replayed: false }, 200, diagnostics);
}
