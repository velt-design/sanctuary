import { studioPackageAssets } from "@/lib/designStudio/clientPackageAssets.server";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ quoteVersionId: string }> },
) {
  const response = await studioPackageAssets(
    request,
    (await context.params).quoteVersionId,
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const POST = GET;
