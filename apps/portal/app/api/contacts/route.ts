import { createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { createContactWithRetry, isRecord, mapContact, readString } from './_shared';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/contacts');
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401, diagnostics);

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
  const createRes = await createContactWithRetry({
    name: displayName,
    email: email || null,
    phone: phone || null,
    created_at: now,
    updated_at: now,
  });

  if (createRes.error || !createRes.data) {
    const message = createRes.error?.message ?? 'Failed to create contact';
    return jsonError(message, 500, diagnostics);
  }

  return jsonOk({ contact: mapContact(createRes.data) }, 200, diagnostics);
}
