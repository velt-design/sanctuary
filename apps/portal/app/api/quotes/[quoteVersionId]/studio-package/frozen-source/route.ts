import { studioPackageDocument } from "@/lib/designStudio/clientPackageDocument.server";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ quoteVersionId: string }> },
) {
  const response = await studioPackageDocument(
    request,
    (await context.params).quoteVersionId,
    true,
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
