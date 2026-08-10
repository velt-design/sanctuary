import {
  jsonError,
  jsonOk,
  parseJsonBody,
  requireStaffContext,
} from "@/lib/api/staffApi";
import {
  privateProjectDesignBookletResponse,
  projectDesignBookletErrorResponse,
} from "@/lib/designBooklets/projectApi";
import { completeProjectDesignBookletAssetUpload } from "@/lib/designBooklets/projectPersistence";
import type { ProjectDesignBookletAssetMediaType } from "@/lib/designBooklets/projectTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const auth = await requireStaffContext();
  if (!auth.ok) return privateProjectDesignBookletResponse(auth.response);
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return privateProjectDesignBookletResponse(
      jsonError("Invalid project ID.", 400),
    );
  }
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return privateProjectDesignBookletResponse(jsonError(parsed.error, 400));
  }

  try {
    const mediaType = parsed.body?.mediaType;
    if (
      !["image/jpeg", "image/png", "application/pdf"].includes(
        String(mediaType),
      )
    ) {
      return privateProjectDesignBookletResponse(
        jsonError("Choose a PNG, JPEG, or PDF asset.", 422),
      );
    }
    const asset = await completeProjectDesignBookletAssetUpload(auth.supabase, {
      projectId: projectId.trim(),
      assetId:
        typeof parsed.body?.assetId === "string" ? parsed.body.assetId : "",
      path: typeof parsed.body?.path === "string" ? parsed.body.path : "",
      fileName:
        typeof parsed.body?.fileName === "string"
          ? parsed.body.fileName
          : "booklet-image.jpg",
      mediaType: mediaType as ProjectDesignBookletAssetMediaType,
      userId: auth.session.user.id,
    });
    return privateProjectDesignBookletResponse(jsonOk({ asset }));
  } catch (error) {
    return projectDesignBookletErrorResponse(
      error,
      "The image could not be saved.",
    );
  }
}
