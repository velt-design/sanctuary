import { studioPackageDelivery } from "@/lib/designStudio/clientPackageDelivery.server";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ quoteVersionId: string }> },
) {
  const response = await studioPackageDelivery(
    request,
    (await context.params).quoteVersionId,
    "prepare",
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const POST = GET;
