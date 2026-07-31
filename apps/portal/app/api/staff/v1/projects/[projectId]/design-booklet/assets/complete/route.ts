import {
  jsonError,
  jsonOk,
  parseJsonBody,
  requireStaffContext,
} from "@/lib/api/staffApi";
import { projectDesignBookletErrorResponse } from "@/lib/designBooklets/projectApi";
import { completeProjectDesignBookletAssetUpload } from "@/lib/designBooklets/projectPersistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  if (!projectId?.trim()) return jsonError("Invalid project ID.", 400);
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  try {
    const asset = await completeProjectDesignBookletAssetUpload(auth.supabase, {
      projectId: projectId.trim(),
      assetId: typeof parsed.body?.assetId === "string" ? parsed.body.assetId : "",
      path: typeof parsed.body?.path === "string" ? parsed.body.path : "",
      fileName:
        typeof parsed.body?.fileName === "string"
          ? parsed.body.fileName
          : "booklet-image.jpg",
      userId: auth.session.user.id,
    });
    const response = jsonOk({ asset });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    return projectDesignBookletErrorResponse(
      error,
      "The image could not be saved.",
    );
  }
}
