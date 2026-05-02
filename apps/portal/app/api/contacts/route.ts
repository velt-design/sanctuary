import { createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
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

  if (!displayName) {
    return jsonError('Contact name is required', 400, diagnostics);
  }

  const now = new Date().toISOString();
  const createRes = await createContactWithRetry(
    {
      name: displayName,
      email: email || null,
      phone: phone || null,
      created_at: now,
      updated_at: now,
    },
    auth.supabase,
  );

  if (createRes.error || !createRes.data) {
    const message = createRes.error?.message ?? 'Failed to create contact';
    return jsonError(message, 500, diagnostics);
  }

  return jsonOk({ contact: mapContact(createRes.data) }, 200, diagnostics);
}
