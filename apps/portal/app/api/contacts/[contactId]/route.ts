import { createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { isRecord, mapContact, readString, updateContactWithRetry } from '../_shared';

export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const diagnostics = createRouteDiagnostics(req, '/api/contacts/[contactId]');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;

  let contactUuid: string;
  try {
    const { contactId } = await ctx.params;
    contactUuid = uuidFromAppId(contactId, 'ct');
  } catch {
    return jsonError('Invalid contactId', 400, diagnostics);
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = isRecord(parsed.body) ? parsed.body : {};

  const displayName = readString(body.displayName);
  const email = readString(body.email);
  const phone = readString(body.phone);

  if (displayName !== null && !displayName) {
    return jsonError('Contact name is required', 400, diagnostics);
  }

  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (displayName !== null) patch.name = displayName;
  if (email !== null) patch.email = email || null;
  if (phone !== null) patch.phone = phone || null;

  const updateRes = await updateContactWithRetry(contactUuid, patch, auth.supabase);
  if (updateRes.error || !updateRes.data) {
    const message = updateRes.error?.message ?? 'Failed to update contact';
    if (typeof message === 'string' && message.toLowerCase().includes('not found')) {
      return jsonError('Contact not found', 404, diagnostics);
    }
    return jsonError(message, 500, diagnostics);
  }

  return jsonOk({ contact: mapContact(updateRes.data) }, 200, diagnostics);
}
