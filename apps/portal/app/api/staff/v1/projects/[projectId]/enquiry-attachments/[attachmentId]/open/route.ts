import { NextResponse } from "next/server";
import { createRouteDiagnostics, logPortalServerError } from "@/lib/api/routeDiagnostics";
import { jsonError, requireStaffContext } from "@/lib/api/staffApi";
import {
  createProjectEnquiryAttachmentSignedUrl,
  ProjectEnquiryAttachmentError,
} from "@/lib/projects/enquiryAttachments/server";
import { supabaseServiceRole } from "@/lib/supabaseClient";

export const runtime = "nodejs";

function privateNoStore(response: Response): Response {
  response.headers.set("cache-control", "private, no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}
export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string; attachmentId: string }> },
) {
  const diagnostics = createRouteDiagnostics(
    req,
    "/api/staff/v1/projects/[projectId]/enquiry-attachments/[attachmentId]/open",
  );
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);

  const url = new URL(req.url);
  const disposition = url.searchParams.get("disposition");
  if (disposition !== "view" && disposition !== "download") {
    return privateNoStore(
      jsonError("Invalid attachment action.", 400, diagnostics),
    );
  }

  const { projectId, attachmentId } = await ctx.params;
  try {
    const signed = await createProjectEnquiryAttachmentSignedUrl(
      auth.supabase,
      supabaseServiceRole,
      {
        projectId,
        attachmentId,
        disposition,
        actorUserId: auth.session.user.id,
        requestId: diagnostics.requestId,
      },
    );
    const response = NextResponse.redirect(signed.signedUrl, 307);
    response.headers.set(
      "x-attachment-url-expires-in",
      String(signed.expiresInSeconds),
    );
    response.headers.set("x-portal-request-id", diagnostics.requestId);
    return privateNoStore(response);
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
      message: "Failed to open project enquiry attachment",
      error,
    });
    return privateNoStore(
      jsonError("The attachment could not be opened.", 500, diagnostics),
    );
  }
}
