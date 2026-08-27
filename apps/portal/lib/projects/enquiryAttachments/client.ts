import { apiJson } from "@/lib/repo/apiClient";
import type { ProjectEnquiryAttachmentsResponse } from "./types";

export function fetchProjectEnquiryAttachments(
  projectId: string,
): Promise<ProjectEnquiryAttachmentsResponse> {
  return apiJson<ProjectEnquiryAttachmentsResponse>(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/enquiry-attachments`,
  );
}
export function projectEnquiryAttachmentOpenHref(
  projectId: string,
  attachmentId: string,
  disposition: "view" | "download",
): string {
  return `/api/staff/v1/projects/${encodeURIComponent(projectId)}/enquiry-attachments/${encodeURIComponent(attachmentId)}/open?disposition=${disposition}`;
}
