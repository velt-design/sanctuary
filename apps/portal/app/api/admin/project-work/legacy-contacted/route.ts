import { jsonError, jsonOk, requireAdminContext } from '@/lib/api/adminApi';
import {
  createRouteDiagnostics,
  logPortalServerError,
} from '@/lib/api/routeDiagnostics';
import { legacyTriageDatabaseError } from '@/lib/projects/workItems/legacyTriage/errors';
import { getLegacyContactedReview } from '@/lib/projects/workItems/legacyTriage/repository';
import { parseLegacyContactedReviewQuery } from '@/lib/projects/workItems/legacyTriage/validation';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(
    req,
    '/api/admin/project-work/legacy-contacted',
  );
  const auth = await requireAdminContext(diagnostics);
  if (!auth.ok) return auth.response;

  const parsed = parseLegacyContactedReviewQuery(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);

  try {
    const review = await getLegacyContactedReview(auth.supabase, parsed.value);
    return jsonOk({ ...review }, 200, diagnostics);
  } catch (error) {
    const mapped = legacyTriageDatabaseError(error);
    if (mapped.status === 500) {
      logPortalServerError(diagnostics, {
        status: mapped.status,
        message: 'Failed to classify old Contacted projects',
        error,
      });
    }
    return jsonError(mapped.message, mapped.status, diagnostics);
  }
}
