export type ProjectEnquiryAttachment = {
  id: string;
  filename: string;
  contentType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  submittedAt: string;
};
export type ProjectEnquiryAttachmentsResponse = {
  attachments: ProjectEnquiryAttachment[];
  generatedAt: string;
};
