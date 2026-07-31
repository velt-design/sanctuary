import { jsonError, jsonOk, requireStaffContext } from "@/lib/api/staffApi";
import { projectDesignBookletErrorResponse } from "@/lib/designBooklets/projectApi";
import { publishProjectDesignBookletPdf } from "@/lib/designBooklets/projectPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  if (!projectId?.trim()) return jsonError("Invalid project ID.", 400);

  try {
    const download = await publishProjectDesignBookletPdf(
      auth.supabase,
      projectId.trim(),
    );
    const response = jsonOk({ download });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    return projectDesignBookletErrorResponse(
      error,
      "The design booklet PDF could not be generated.",
    );
  }
}
