import { studioPackageDelivery } from "@/lib/designStudio/clientPackageDelivery.server";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ quoteVersionId: string }> },
) {
  const response = await studioPackageDelivery(
    request,
    (await context.params).quoteVersionId,
    "cancel",
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
