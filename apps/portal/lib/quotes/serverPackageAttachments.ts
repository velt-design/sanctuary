import "server-only";
import { supabaseServiceRole } from "@/lib/supabaseClient";
/** Resolve existing immutable artifacts without sending bytes through the browser multipart boundary. */
export async function resolveQuotePackageAttachments(params: {
  projectUuid: string;
  ids: string[];
  hasUploadedAttachments: boolean;
  maxCount: number;
  maxBytes: number;
  isAllowed: (type: string, name: string) => boolean;
  allowedBookletFileId?: string;
}) {
  const { ids } = params;
  if (
    params.hasUploadedAttachments ||
    ids.length > params.maxCount ||
    new Set(ids).size !== ids.length
  )
    throw Error("Invalid package attachments");
  if (!ids.length) return [];
  const result = await supabaseServiceRole
    .from("file_artifacts")
    .select("id,filename,content_type,content_base64,size_bytes,created_by")
    .eq("project_id", params.projectUuid)
    .in("id", ids);
  if (result.error) throw Error("Package attachments could not be checked");
  let total = 0;
  return ids.map((id) => {
    const row = result.data?.find((item: any) => item.id === id);
    if (!row) throw Error("A package file is unavailable");
    if (
      row.created_by === "background:studio-documents" &&
      row.id !== params.allowedBookletFileId
    )
      throw Error(
        "Design booklets use the document selection. Remove their duplicate loose attachment.",
      );
    const content = Buffer.from(row.content_base64, "base64");
    total += content.length;
    if (
      !params.isAllowed(row.content_type, row.filename) ||
      !content.length ||
      content.length !== row.size_bytes ||
      content.length > params.maxBytes ||
      total > params.maxBytes
    )
      throw Error(
        "Combined extra attachments must be 4MB or smaller. Remove a file or rendered view and try again.",
      );
    return {
      fileUuid: id,
      filename: row.filename,
      contentType: row.content_type,
      content,
    };
  });
}
