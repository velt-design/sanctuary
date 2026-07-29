import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import {
  parseProjectCreateRequest,
  type ProjectCreateResponse,
} from '@/lib/projects/createProjectContract';
import {
  createProjectCommand,
  ProjectCreateAutomationAttentionError,
  ProjectCreateCommandConflictError,
  ProjectCreateDuplicateContactsError,
  ProjectCreateRecoveryError,
  ProjectCreateSchemaError,
} from '@/lib/projects/createProjectCommand';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/projects');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;

  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) return jsonError(parsedBody.error, 400, diagnostics);
  const parsed = parseProjectCreateRequest(parsedBody.body);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);

  try {
    const result: ProjectCreateResponse = await createProjectCommand(auth.supabase, parsed.value);
    const response = jsonOk(result, 200, diagnostics);
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    if (error instanceof ProjectCreateAutomationAttentionError) {
      logPortalServerError(diagnostics, {
        event: 'projects.create.setup_attention',
        status: 202,
        message: 'Project saved; initial setup automation needs review',
        error,
      });
      const response = jsonOk(error.response, 202, diagnostics);
      response.headers.set('cache-control', 'private, no-store');
      return response;
    }
    if (error instanceof ProjectCreateDuplicateContactsError) {
      return jsonError(error.message, 409, diagnostics, {
        code: 'CONTACT_DUPLICATE_CANDIDATES',
        candidates: error.candidates,
      });
    }
    if (error instanceof ProjectCreateCommandConflictError) {
      return jsonError(error.message, 409, diagnostics, {
        code: 'PROJECT_CREATION_COMMAND_CONFLICT',
      });
    }
    if (error instanceof ProjectCreateSchemaError) {
      return jsonError(error.message, 503, diagnostics, {
        code: 'PROJECT_CREATION_SCHEMA_NOT_READY',
      });
    }
    if (error instanceof ProjectCreateRecoveryError) {
      logPortalServerError(diagnostics, {
        event: 'projects.create.recovery_required',
        status: 500,
        message: 'Project creation cleanup could not be verified',
        error,
      });
      return jsonError(
        'Project creation could not be confirmed. Do not retry; ask a portal administrator to reconcile this request.',
        500,
        diagnostics,
        { code: 'PROJECT_CREATION_REVIEW_REQUIRED' },
      );
    }
    logPortalServerError(diagnostics, {
      event: 'projects.create.failed',
      status: 500,
      message: 'Project creation failed',
      error,
    });
    return jsonError('Project could not be created. Nothing was saved; retry is safe.', 500, diagnostics);
  }
}
