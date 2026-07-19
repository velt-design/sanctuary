import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { loadContactsIndexData } from '@/lib/contacts/serverContactsIndex';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/contacts/index');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;

  try {
    const contacts = await loadContactsIndexData(auth.supabase);
    const response = jsonOk(
      {
        contacts,
        generatedAt: new Date().toISOString(),
      },
      200,
      diagnostics,
    );
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    logPortalServerError(diagnostics, {
      event: 'contacts.index.load_failed',
      status: 500,
      message: 'Failed to load contacts',
      error,
    });
    return jsonError('Failed to load contacts', 500, diagnostics);
  }
}
