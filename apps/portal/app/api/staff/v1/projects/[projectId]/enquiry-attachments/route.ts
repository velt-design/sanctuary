import { createRouteDiagnostics, logPortalServerError } from "@/lib/api/routeDiagnostics";
import { jsonError, jsonOk, requireStaffContext } from "@/lib/api/staffApi";
import {
  listProjectEnquiryAttachments,
  ProjectEnquiryAttachmentError,
} from "@/lib/projects/enquiryAttachments/server";

export const runtime = "nodejs";

function privateNoStore(response: Response): Response {
  response.headers.set("cache-control", "private, no-store");
  return response;
}
export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const diagnostics = createRouteDiagnostics(
    req,
    "/api/staff/v1/projects/[projectId]/enquiry-attachments",
  );
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);

  const { projectId } = await ctx.params;
  try {
    const attachments = await listProjectEnquiryAttachments(
      auth.supabase,
      projectId,
    );
    return privateNoStore(
      jsonOk(
        { attachments, generatedAt: new Date().toISOString() },
        200,
        diagnostics,
      ),
    );
  } catch (error) {
    if (error instanceof ProjectEnquiryAttachmentError) {
      return privateNoStore(
        jsonError(error.message, error.status, diagnostics, {
          code: error.code,
        }),
      );
    }
    logPortalServerError(diagnostics, {
      status: 500,
      message: "Failed to list project enquiry attachments",
      error,
    });
    return privateNoStore(
      jsonError("Project files could not be loaded.", 500, diagnostics),
    );
  }
}
