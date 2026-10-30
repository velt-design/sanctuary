import type { StudioClientDocumentStatus } from "./clientDocumentStatus";
export type StudioPackageDraftValue = {
  to: string;
  subject: string;
  message: string;
  includeBooklet: boolean;
  renderFileIds: string[];
  fileIds: string[];
};
export type StudioPackageFile = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  renderEligible: boolean;
  separateEligible?:boolean;
};
export type StudioPackageDraft = {
  revision: number;
  value: StudioPackageDraftValue;
  documentId: string | null;
  preparedIntentId: string | null;
  preparedRevision: number | null;
};
export type StudioPackageState = {
  draft: StudioPackageDraft;
  document: StudioClientDocumentStatus | null;
  files: StudioPackageFile[];
  filesHasMore?: boolean;
  filesOffset?: number;
  enquiryFiles?: import("@/lib/projects/enquiryAttachments/types").ProjectEnquiryAttachment[];
  canSend?: boolean;
  prepared?: {
    id: string;
    subject: string;
    text: string | null;
    to: string[];
    attachmentNames: string[];
    payloadHash: string;
    status: string;
  } | null;
};
export function parseStudioPackageDraft(
  value: unknown,
): StudioPackageDraftValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid client package");
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).sort().join(",") !==
      "fileIds,includeBooklet,message,renderFileIds,subject,to" ||
    typeof row.to !== "string" ||
    row.to.length > 320 ||
    typeof row.subject !== "string" ||
    row.subject.length > 200 ||
    typeof row.message !== "string" ||
    row.message.length > 10000 ||
    row.message.includes("\u2014") ||
    row.subject.includes("\u2014") ||
    typeof row.includeBooklet !== "boolean"
  )
    throw Error(
      "Check the package recipient and message. Use full stops or commas instead of long dashes.",
    );
  for (const key of ["renderFileIds", "fileIds"])
    if (
      !Array.isArray(row[key]) ||
      (row[key] as unknown[]).length > (key === "renderFileIds" ? 8 : 9) ||
      (row[key] as unknown[]).some(
        (id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id),
      ) ||
      new Set(row[key] as unknown[]).size !== (row[key] as unknown[]).length
    )
      throw Error("Invalid package files");
  if (
    (row.renderFileIds as string[]).some((id) =>
      (row.fileIds as string[]).includes(id),
    )
  )
    throw Error("Rendered pages cannot also be loose attachments.");
  return row as StudioPackageDraftValue;
}
export function studioPackageReady(state: StudioPackageState) {
  return !state.draft.value.includeBooklet || state.document?.state === "ready";
}
export function studioPackageFilename(name: string) {
  return name.replace(/[\u0000-\u001f/\\]/g, "_").replace(/\u2014/g, ",");
}
export function studioPackageDefaultMessage(projectName: string) {
  return [
    "Please find your quote for " + projectName.replace(/\u2014/g, ",") + ".",
    "",
    "Please let us know if you have any questions.",
  ].join("\n");
}
/** SQL JSONB key order is not draft identity; selected file order is. */
export function studioPackageDraftKey(
  value: StudioPackageDraftValue | null | undefined,
) {
  return value
    ? JSON.stringify([
        value.to,
        value.subject,
        value.message,
        value.includeBooklet,
        value.renderFileIds,
        value.fileIds,
      ])
    : "none";
}
