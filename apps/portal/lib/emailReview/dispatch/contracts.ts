/** Portal records review and dispatch evidence; Outlook owns the actual reply. */
export type DispatchState = 'ready' | 'attempting' | 'sent' | 'uncertain' | 'cancelled';
export type DispatchSummary = {
  id: string; itemId: string; projectName: string; to: string; subject: string;
  state: DispatchState; attemptId: string | null; attemptedAt: string | null; sentAt: string | null;
  outlookMessageId: string | null; outlookWebLink: string | null;
};
export type DispatchOverview = {
  batchId: string; prepared: boolean;
  counts: Record<DispatchState, number>;
  items: DispatchSummary[];
};
export type DispatchReply = {
  id: string; attemptId: string; itemId: string; projectId: string;
  mailbox: 'info@sanctuarypergolas.co.nz'; messageId: string; to: string;
  subject: string; body: string; approvalHash: string;
};
export type DispatchClaim = { replayed: boolean; replies: DispatchReply[] };
export type DispatchResult = {
  intentId: string; attemptId: string; outcome: 'sent' | 'uncertain';
  outlookMessageId?: string; outlookWebLink?: string; note?: string;
};
