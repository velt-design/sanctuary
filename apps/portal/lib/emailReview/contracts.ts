/** Human review only. Approval does not enqueue or send a message. */
export type EmailReviewStatus = 'draft' | 'approved' | 'skipped';
export type EmailReviewEvidence = { label: string; url: string };
export type EmailReviewThread = { messageId: string; webLink: string; subject: string; matchedRecipient: string };
export type EmailReviewImportItem = {
  sourceId: string; projectId: string; to: string; subject: string; body: string;
  prerequisites: string[]; evidence: EmailReviewEvidence[]; context: string;
  threads?: EmailReviewThread[];
};
export type EmailReviewImport = {
  commandId: string; sourceKey: string; title: string; reviewerId: string; items: EmailReviewImportItem[];
};
export type EmailReviewCommand = {
  commandId: string; expectedRevision: number; action: 'save' | 'approve' | 'skip' | 'unapprove';
  to?: string; subject?: string; body?: string; note?: string;
  prerequisitesConfirmed?: boolean;
  threadConfirmed?: boolean;
  /** Explicitly accept freshly displayed project/contact context while saving; invalidates approval. */
  acknowledgeContextChange?: boolean;
  expectedContextHash?: string;
  threadMessageId?: string | null;
};
export type EmailReviewCounts = { all: number; draft: number; approved: number; skipped: number };
export type EmailReviewBatch = { id: string; sourceKey: string; title: string; reviewerId: string; createdAt: string; counts: EmailReviewCounts };
export type EmailReviewProjectContext = {
  projectId: string; name: string; stage: string; archivedAt: string | null;
  contactId: string | null; contactName: string | null; contactEmail: string | null;
  state: string | null; stateVersion: number | null;
};
export type EmailReviewSummary = {
  id: string; batchId: string; sourceId: string; projectId: string; projectName: string;
  to: string; subject: string; status: EmailReviewStatus; revision: number; updatedAt: string;
  contextChanged: boolean;
};
export type EmailReviewItem = EmailReviewSummary & {
  body: string; prerequisites: string[]; evidence: EmailReviewEvidence[]; context: string;
  savedProjectContext: EmailReviewProjectContext; currentProjectContext: EmailReviewProjectContext;
  currentContextHash: string;
  threads: EmailReviewThread[]; threadMessageId: string | null;
  dispatchId: string | null;
  approvedAt: string | null; approvedBy: string | null; approvalHash: string | null;
  events: { id: string; action: string; actorId: string; revision: number; note: string | null; createdAt: string }[];
};
export type EmailReviewBatchPage = { batch: EmailReviewBatch; items: EmailReviewSummary[]; page: number; limit: number; total: number; counts: EmailReviewCounts };
export type EmailReviewImportResult = { batchId: string; imported: number; existing: boolean };
