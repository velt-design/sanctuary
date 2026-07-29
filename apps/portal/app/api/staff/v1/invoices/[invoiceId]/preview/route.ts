import { jsonError, jsonOk, requireStaffSession } from "@/lib/api/staffApi";
import { getDepositInvoiceArtifactPreview } from "@/lib/invoices/server";
import { uuidFromAppId } from "@/lib/supabase/mappers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ invoiceId: string }>;
};

function privateNoStore(response: Response): Response {
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const session = await requireStaffSession();
  if (!session) return privateNoStore(jsonError("Unauthorized", 401));

  const { invoiceId } = await context.params;
  const id = typeof invoiceId === "string" ? invoiceId.trim() : "";
  if (!id) return privateNoStore(jsonError("Invalid invoiceId", 400));
  try {
    uuidFromAppId(id, "inv");
  } catch {
    return privateNoStore(jsonError("Invalid invoiceId", 400));
  }

  try {
    const preview = await getDepositInvoiceArtifactPreview(id);
    if (!preview) {
      return privateNoStore(jsonError("Invoice not found", 404));
    }
    return privateNoStore(jsonOk({ preview }));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to render invoice preview";
    return privateNoStore(jsonError(message, 500));
  }
}
