import {
  jsonError,
  jsonOk,
  parseJsonBody,
  requireStaffContext,
} from "@/lib/api/staffApi";
import { projectDesignBookletErrorResponse } from "@/lib/designBooklets/projectApi";
import {
  loadProjectDesignBooklet,
  saveProjectDesignBooklet,
} from "@/lib/designBooklets/projectPersistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  if (!projectId?.trim()) return jsonError("Invalid project ID.", 400);

  try {
    const snapshot = await loadProjectDesignBooklet(
      auth.supabase,
      projectId.trim(),
    );
    const response = jsonOk({ snapshot });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    return projectDesignBookletErrorResponse(
      error,
      "The design booklet could not be loaded.",
    );
  }
}

export async function PUT(request: Request, context: Context): Promise<Response> {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  if (!projectId?.trim()) return jsonError("Invalid project ID.", 400);
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  try {
    const saved = await saveProjectDesignBooklet(auth.supabase, {
      projectId: projectId.trim(),
      draft: parsed.body?.draft,
      expectedRevision: parsed.body?.expectedRevision,
      userId: auth.session.user.id,
    });
    const response = jsonOk({ saved });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    return projectDesignBookletErrorResponse(
      error,
      "The design booklet could not be saved.",
    );
  }
}
