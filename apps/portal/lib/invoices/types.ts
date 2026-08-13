type DepositInvoiceStatus = 'OPEN' | 'PAID' | 'VOID';

export type DepositInvoiceDeliveryStatus = 'NOT_SENT' | 'SENT' | 'FAILED';

export type DepositInvoiceSummary = {
  id: string;
  projectId: string;
  quoteId: string;
  quoteVersionId: string;
  quoteRef: string;
  quoteVersionNumber: number;
  invoiceRef: string;
  status: DepositInvoiceStatus;
  paymentTermId: string;
  paymentTermLabel: string;
  paymentTermPosition: number;
  paymentTermCount: number;
  paymentTermCalculation: 'fixed' | 'percentage';
  paymentTermPercentage: number | null;
  issueDate: string;
  dueDate: string;
  reference: string | null;
  customerName: string | null;
  projectName: string | null;
  projectAddress: string | null;
  depositPercent: number;
  totalIncGstCents: number;
  totalExGstCents: number;
  gstCents: number;
  createdAt: string;
  sentAt: string | null;
  paidAt: string | null;
  paidBy: string | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  paymentNote: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  lastDeliveryStatus: DepositInvoiceDeliveryStatus;
  lastDeliveryError: string | null;
  lastDeliveryAttemptAt: string | null;
  nextRetryAt: string | null;
  finalFailure: boolean;
  recipients: string[];
};

export type InvoiceScheduleTerm = {
  quoteVersionId: string;
  quoteRef: string;
  quoteVersionNumber: number;
  commercialScopeKind?: 'base' | 'add_on';
  paymentTermId: string;
  label: string;
  position: number;
  termCount: number;
  amountIncGstCents: number;
  allocatedPaidIncGstCents: number;
  remainingAmountIncGstCents: number;
  source: 'quote' | 'instalment' | 'custom';
  invoice: DepositInvoiceSummary | null;
};

type InvoiceScheduleQuote = {
  quoteVersionId: string;
  quoteRef: string;
  quoteVersionNumber: number;
  commercialScopeKind: 'base' | 'add_on';
  totalIncGstCents: number;
  remainingToInvoiceIncGstCents: number;
};

type ProjectPaymentAllocationSummary = {
  id: string;
  quoteVersionId: string;
  paymentTermId: string;
  stageLabel: string;
  amountIncGstCents: number;
  isCurrentSchedule: boolean;
};

export type ProjectPaymentEntrySummary = {
  id: string;
  entryType: 'PAYMENT' | 'ADJUSTMENT' | 'REVERSAL';
  amountIncGstCents: number;
  occurredAt: string;
  paymentMethod: string | null;
  reference: string | null;
  note: string | null;
  reason: string | null;
  sourceInvoiceId: string | null;
  sourceInvoiceRef: string | null;
  reversed: boolean;
  allocations: ProjectPaymentAllocationSummary[];
  unallocatedIncGstCents: number;
};

export type ProjectInvoiceSchedule = {
  acceptedQuoteVersionId: string | null;
  acceptedQuoteRef: string | null;
  acceptedQuoteVersionNumber: number | null;
  acceptedQuoteTotalIncGstCents: number;
  invoicedIncGstCents: number;
  paidIncGstCents: number;
  outstandingIncGstCents: number;
  remainingToInvoiceIncGstCents: number;
  unallocatedCreditIncGstCents: number;
  acceptedQuotes?: InvoiceScheduleQuote[];
  terms: InvoiceScheduleTerm[];
  paymentEntries?: ProjectPaymentEntrySummary[];
};

export type AdminInvoiceCreationMode = 'next_stage' | 'full_remaining' | 'custom' | 'split';

export type AdminInvoiceCreateInput = {
  projectId: string;
  quoteVersionId: string;
  mode: AdminInvoiceCreationMode;
  paymentTermId?: string | null;
  amountIncGstCents?: number | null;
  splitCount?: number | null;
  label: string;
  dueDate?: string | null;
  reference?: string | null;
  sendNow?: boolean;
  allowOverInvoice?: boolean;
  overrideReason?: string | null;
  calculationBasis?: 'fixed' | 'percentage';
  percentage?: number | null;
  clientIntentId?: string;
};

export type QuoteInvoiceCreateResult = {
  invoice: DepositInvoiceSummary;
  created: boolean;
  sent: boolean;
  alreadySent: boolean;
  sendError: string | null;
  plannedItemCount?: number;
  remainingBeforeIncGstCents?: number;
  remainingAfterIncGstCents?: number;
};

export type DepositInvoiceArtifactPreview = {
  invoiceId: string;
  invoiceRef: string;
  subject: string;
  html: string;
  text: string | null;
  recipients: {
    to: string[];
    cc: string[];
    bcc: string[];
  };
  attachmentNames: string[];
  source: 'prepared' | 'prospective';
};
