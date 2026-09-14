import type { MatchInvoice, PaymentSuggestion, ReceiptCandidate } from './paymentSuggestions';
export type PilotContext = {
  invoice: MatchInvoice & { currency: string };
  invoiceFingerprint: string;
  ledgerFingerprint: string;
  matchedCents: number;
  customerWon: boolean;
  hasUnmatchedPaymentHistory: boolean;
};
export type VerifiedReceipt = ReceiptCandidate & { contactId: string; transactionType: string; updatedAt: string };
export type PilotMatch = {
  id: string; tenantId: string; receiptId: string; invoiceId: string; projectId: string;
  paymentEntryId: string; amountCents: number; receiptDate: string;
  approvedBy: string; approvedAt: string; reversedAt: string | null; evidenceFingerprint: string;
};
export type PilotSuggestion = PaymentSuggestion & { approvalToken: string | null; approvalId: string | null };
export type PilotReviewNote = { id:string; receiptId:string; disposition:'REJECTED'|'INVESTIGATE'; reason:string; recordedAt:string };
export type PilotReview = { context: PilotContext; suggestions: PilotSuggestion[]; matches: PilotMatch[]; notes:PilotReviewNote[]; checkedAt: string; limited: boolean };
