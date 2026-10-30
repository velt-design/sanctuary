import { studioPackageRequest } from "@/lib/designStudio/clientPackageRequest.server";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ quoteVersionId: string }> },
) {
  const response = await studioPackageRequest(
    request,
    (await context.params).quoteVersionId,
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const PUT = GET;
