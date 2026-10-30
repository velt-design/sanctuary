import "server-only";
import { studioCustomerEmailEnabled } from '@/lib/quotes/studioEmailPolicy.server';
import { getQuoteVersionDetail } from "@/lib/quotes/serverCore";
import { readStudioPackageEmail } from "@/lib/quotes/serverEmail";
import type { StudioPackageContext } from "./clientPackageContext.server";
import { packageRpc } from "./clientPackageContext.server";
import type { StudioPackageDraft, StudioPackageState } from "./clientPackage";
import { studioPackageDefaultMessage } from "./clientPackage";
import { listProjectEnquiryAttachments } from "@/lib/projects/enquiryAttachments/server";
import { classifyStudioPackageFiles } from "./clientPackageFiles.server";
export async function readStudioPackage(
  context: StudioPackageContext,
  includeFiles = true,
): Promise<StudioPackageState> {
  let draft = (await packageRpc(
    context,
    "studio_client_package_read",
  )) as StudioPackageDraft | null;
  const document = draft?.documentId
    ? await packageRpc(context, "studio_client_document_variant_status", {
        p_document_id: draft.documentId,
        p_download: false,
      })
    : await packageRpc(context, "studio_client_document_status", {
        p_download: false,
      });
  if (!draft) {
    const detail = await getQuoteVersionDetail(context.id.appId);
    if (!detail || detail.projectId !== `proj_${context.projectId}`)
      throw Error("The quote context changed");
    draft = {
      revision: 0,
      value: {
        to: detail.contact.email ?? "",
        subject: `Your Sanctuary quote ${detail.quoteRef}`,
        message: studioPackageDefaultMessage(detail.project.name),
        includeBooklet: document?.state !== "unavailable",
        renderFileIds: [],
        fileIds: [],
      },
      documentId: document?.documentId ?? document?.snapshotId ?? null,
      preparedIntentId: null,
      preparedRevision: null,
    };
  }
  const filePage = includeFiles
      ? await packageRpc(context, "studio_client_package_files", {
          p_offset: 0,
        })
      : null,
    files = await classifyStudioPackageFiles(
      context,
      filePage?.files ?? [],
      draft.value.fileIds,
    );
  const prepared = draft.preparedIntentId
    ? await readStudioPackageEmail(context.id.appId, draft.preparedIntentId)
    : null;
  const enquiryFiles = includeFiles
    ? await listProjectEnquiryAttachments(
        context.auth.supabase,
        `proj_${context.projectId}`,
      )
    : [];
  return {
    draft,
    document,
    files,
    filesHasMore: filePage?.hasMore ?? false,
    filesOffset: 0,
    enquiryFiles,
    prepared,
    canSend: studioCustomerEmailEnabled(),
  };
}
