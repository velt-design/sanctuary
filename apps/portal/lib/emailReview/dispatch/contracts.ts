/** Portal records review and dispatch evidence; Outlook owns the actual message. */
export type DispatchState = 'ready' | 'attempting' | 'sent' | 'uncertain' | 'cancelled';
export type DispatchSummary = {
  id: string; itemId: string; projectName: string; to: string; subject: string;
  state: DispatchState; attemptId: string | null; attemptedAt: string | null; sentAt: string | null;
  outlookMessageId: string | null; outlookWebLink: string | null;
  actualDeliveryMode: 'reply' | 'new' | null; fallbackReason: 'anchor_not_found_before_send' | null;
};
export type DispatchOverview = {
  batchId: string; prepared: boolean;
  counts: Record<DispatchState, number>;
  items: DispatchSummary[];
};
export type DispatchReply = {
  id: string; attemptId: string; itemId: string; projectId: string;
  mailbox: 'info@sanctuarypergolas.co.nz'; deliveryMode: 'reply' | 'new'; messageId: string | null; to: string;
  allowFreshFallback: boolean;
  subject: string; body: string; approvalHash: string;
};
export type DispatchClaim = { replayed: boolean; replies: DispatchReply[] };
export type DispatchResult = {
  intentId: string; attemptId: string; outcome: 'sent' | 'uncertain';
  outlookMessageId?: string; outlookWebLink?: string; note?: string;
  /** Required by the DB for v2 accepted messages, including uncertain results. */
  actualDeliveryMode?: 'reply' | 'new'; fallbackReason?: 'anchor_not_found_before_send';
};
