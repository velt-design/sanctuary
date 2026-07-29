import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import {
  DEFAULT_CONTACTS_INDEX_PARAMS,
  isContactsIndexSort,
  parseContactsIndexPageSize,
} from '@/lib/contacts/contactsIndexContract';
import {
  ContactsIndexSchemaError,
  loadContactsIndexData,
} from '@/lib/contacts/serverContactsIndex';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/contacts/index');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;

  const searchParams = new URL(req.url).searchParams;
  const search = searchParams.get('q')?.trim() ?? '';
  const page = Number(searchParams.get('page') ?? DEFAULT_CONTACTS_INDEX_PARAMS.page);
  const pageSize = parseContactsIndexPageSize(searchParams.get('pageSize'))
    ?? DEFAULT_CONTACTS_INDEX_PARAMS.pageSize;
  const rawSort = searchParams.get('sort')?.trim() ?? DEFAULT_CONTACTS_INDEX_PARAMS.sort;
  if (search.length > 80) return jsonError('q must be 80 characters or fewer', 400, diagnostics);
  if (!Number.isInteger(page) || page < 1) return jsonError('page must be a positive integer', 400, diagnostics);
  if (!isContactsIndexSort(rawSort)) return jsonError('Invalid contacts sort', 400, diagnostics);

  try {
    const contacts = await loadContactsIndexData({
      search,
      page,
      pageSize,
      sort: rawSort,
    }, auth.supabase);
    const response = jsonOk(
      {
        contacts,
        query: { search, sort: rawSort },
        generatedAt: new Date().toISOString(),
      },
      200,
      diagnostics,
    );
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    if (error instanceof ContactsIndexSchemaError) {
      return jsonError(error.message, 503, diagnostics, {
        code: 'CONTACTS_INDEX_SCHEMA_NOT_READY',
      });
    }
    logPortalServerError(diagnostics, {
      event: 'contacts.index.load_failed',
      status: 500,
      message: 'Failed to load contacts',
      error,
    });
    return jsonError('Failed to load contacts', 500, diagnostics);
  }
}
