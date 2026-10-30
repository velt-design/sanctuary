import "server-only";
import { jsonError, jsonOk } from "@/lib/api/staffApi";
import {
  studioPackageContext,
  packageRpc,
} from "./clientPackageContext.server";
import {
  createStudioAuthoringEdit,
  type StudioAuthoringView,
} from "./authoringView";
export async function studioPackageDocument(
  request: Request,
  quoteVersionId: string,
  frozen = false,
) {
  const context = await studioPackageContext(request, quoteVersionId);
  if (!context.ok) return context.response;
  try {
    if (frozen) {
      const view = (await packageRpc(
        context,
        "studio_client_package_frozen_source",
      )) as StudioAuthoringView;
      if (!view || view.schemaVersion !== "studio_authoring_view.v1")
        throw Error("The frozen design is unavailable");
      return jsonOk({ edit: createStudioAuthoringEdit(view) });
    }
    const params = new URL(request.url).searchParams,
      documentId = params.get("documentId"),
      revision = Number(params.get("revision"));
    if (
      !documentId ||
      !/^[a-f0-9-]{36}$/i.test(documentId) ||
      !params.has("revision") ||
      !Number.isSafeInteger(revision) ||
      revision < 0
    )
      return jsonError(
        "Review the current booklet selection before opening it.",
        409,
      );
    const download = params.get("download") === "1";
    const document = await packageRpc(
      context,
      "studio_client_package_document",
      {
        p_expected_revision: revision,
        p_document_id: documentId,
        p_download: download,
        p_retry: request.method === "POST",
      },
    );
    if (!download) return jsonOk({ document });
    if (document?.state !== "ready" || !document.file)
      return jsonError(
        "The selected design booklet is still being prepared.",
        409,
      );
    return new Response(Buffer.from(document.file.contentBase64, "base64"), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${document.file.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Studio-Document-Id": document.documentId,
        "X-Studio-Package-Revision": String(document.packageRevision),
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "The booklet could not be loaded.",
      409,
    );
  }
}
