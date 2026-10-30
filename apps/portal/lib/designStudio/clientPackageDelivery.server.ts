import "server-only";
import { jsonError, jsonOk } from "@/lib/api/staffApi";
import {
  prepareStudioPackageEmail,
  readStudioPackageEmail,
  sendPreparedStudioPackageEmail,
} from "@/lib/quotes/serverEmail";
import {
  studioPackageContext,
  packageRpc,
} from "./clientPackageContext.server";
import { readStudioRequestBody } from "./readRequestBody.server";
import type { StudioPackageDraft } from "./clientPackage";
import { STUDIO_EMAIL_DISABLED_REASON, studioCustomerEmailEnabled } from '@/lib/quotes/studioEmailPolicy.server';
export async function studioPackageDelivery(
  request: Request,
  quoteVersionId: string,
  action: "prepare" | "cancel" | "send",
) {
  const context = await studioPackageContext(request, quoteVersionId);
  if (!context.ok) return context.response;
  if (
    action === "send" &&
    !studioCustomerEmailEnabled()
  )
    return jsonError(STUDIO_EMAIL_DISABLED_REASON, 409);
  try {
    const draft = (await packageRpc(
      context,
      "studio_client_package_read",
    )) as StudioPackageDraft | null;
    if (!draft)
      return jsonError("Save the package before preparing its email.", 409);
    if (request.method === "GET")
      return jsonOk({
        prepared: draft.preparedIntentId
          ? await readStudioPackageEmail(
              context.id.appId,
              draft.preparedIntentId,
            )
          : null,
      });
    const body = (await readStudioRequestBody(request, 1024)) as {
      revision: number;
      intentId?: string;
    };
    if (body.revision !== draft.revision)
      return jsonError(
        "This package changed. Review its current contents.",
        409,
      );
    if (action === "prepare") {
      if (draft.preparedIntentId)
        return jsonOk({
          prepared: await readStudioPackageEmail(
            context.id.appId,
            draft.preparedIntentId,
          ),
        });
      if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(draft.value.to))
        return jsonError("Enter one valid recipient email.", 400);
      const attachments = [...draft.value.fileIds];
      if (draft.value.includeBooklet) {
        if (!draft.documentId)
          return jsonError("This quote has no design booklet.", 409);
        const document = await packageRpc(
          context,
          "studio_client_document_variant_status",
          { p_document_id: draft.documentId, p_download: true },
        );
        if (document?.state !== "ready" || !document.file?.id)
          return jsonError(
            "The selected design booklet is still being prepared.",
            409,
          );
        attachments.unshift(document.file.id);
      }
      await prepareStudioPackageEmail(
        context.id.appId,
        {
          intentId: `studio-package:${context.id.uuid}:${draft.revision}`,
          expectedCommercialRevision: context.commercialRevision,
          to: [draft.value.to],
          subject: draft.value.subject,
          personalNote: draft.value.message,
          artifactIds: attachments,
          studioPackage: {
            actorUserId: context.actorId,
            revision: draft.revision,
            documentId: draft.documentId,
            value: draft.value,
          },
        },
        context.actorId,
      );
      const saved = await packageRpc(context, "studio_client_package_read");
      return jsonOk({
        prepared: await readStudioPackageEmail(
          context.id.appId,
          saved.preparedIntentId,
        ),
      });
    }
    if (!draft.preparedIntentId || draft.preparedRevision !== draft.revision)
      return jsonError("Prepare this package before continuing.", 409);
    const prepared = await readStudioPackageEmail(
      context.id.appId,
      draft.preparedIntentId,
    );
    if (action === "cancel") {
      await packageRpc(context, "studio_client_package_cancel", {
        p_expected_revision: draft.revision,
        p_intent_id: prepared.id,
        p_payload_hash: prepared.payloadHash,
        p_commercial_revision: context.commercialRevision,
      });
      return jsonOk({
        draft: await packageRpc(context, "studio_client_package_read"),
      });
    }
    return jsonOk({
      quoteVersion: await sendPreparedStudioPackageEmail(
        context.id.appId,
        prepared.id,
        context.actorId,
      ),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "The package email could not be prepared.",
      409,
    );
  }
}
