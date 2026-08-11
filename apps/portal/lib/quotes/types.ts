import type { QuotePaymentTerm } from './paymentSchedule';

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'SUPERSEDED';

export type QuoteTotals = {
  totalIncGstCents: number;
  totalExGstCents: number;
  gstCents: number;
};

export type QuoteLineItem = {
  id: string;
  description: string;
  qty: number;
  unitPriceIncGstCents: number;
  lineTotalIncGstCents: number;
  sortOrder: number;
};

export type QuoteVersion = {
  id: string;
  quoteId: string;
  projectId: string;
  commercialScopeId?: string | null;
  commercialScopeKind?: 'base' | 'add_on';
  quoteRef: string;
  internalName?: string | null;
  versionNumber: number;
  status: QuoteStatus;
  depositPercent: number;
  paymentTerms?: QuotePaymentTerm[];
  sourceEstimateVersionId: string;
  sourceEstimateVersionLabel: string;
  revisedFromQuoteVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
  commercialRevision: number;
  isCurrentDraft: boolean;
  deliveryPreparedAt: string | null;
  createdBy?: string | null;
  sentAt?: string | null;
  sentBy?: string | null;
  supersededAt?: string | null;
  supersededBy?: string | null;
  expiresAt?: string | null;
  reference?: string | null;
  customerName?: string | null;
  introText?: string | null;
  termsText?: string | null;
  totals: QuoteTotals;
  pdfFileId?: string | null;
  renderHash?: string | null;
  pricingSource: 'calculator_live' | 'workbench_solved';
};

export type QuoteSendLog = {
  id: string;
  projectId: string;
  quoteVersionId: string;
  fromName?: string | null;
  fromEmail?: string | null;
  replyToEmail?: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  attachments: string[];
  provider?: string | null;
  providerMessageId?: string | null;
  status: 'SENT' | 'FAILED';
  errorMessage?: string | null;
  createdAt: string;
  createdBy?: string | null;
  sentAt?: string | null;
};

export type QuoteVersionDetail = QuoteVersion & {
  lineItems: QuoteLineItem[];
  sendLogs: QuoteSendLog[];
  commercialWorkflowReady?: boolean;
  contact: {
    name: string;
    email: string;
    phone?: string | null;
  };
  project: {
    name: string;
    siteAddress?: string | null;
    region?: string | null;
    quoteRef?: string | null;
  };
  unfinishedDelivery?: {
    mode: 'send' | 'resend';
    status:
      | 'prepared'
      | 'dispatching'
      | 'provider_accepted'
      | 'failed'
      | 'needs_attention';
    canRetry: boolean;
  } | null;
};

type QuoteAcceptanceInvoice = {
  id: string;
  invoiceRef: string;
  sent: boolean;
  sendError: string | null;
  deliveryState:
    | 'not_started'
    | 'prepared'
    | 'sending'
    | 'sent'
    | 'retry_available'
    | 'failed'
    | 'needs_attention';
};

export type QuoteAcceptResult = {
  quoteVersion: QuoteVersionDetail;
  invoice: QuoteAcceptanceInvoice | null;
  alreadyAccepted?: boolean;
};

export type PreparedQuoteDeliverySummary = {
  mode: 'send' | 'resend';
  status:
    | 'prepared'
    | 'dispatching'
    | 'provider_accepted'
    | 'failed'
    | 'needs_attention';
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyText: string | null;
  attachmentNames: string[];
  preparedAt: string;
  attemptCount: number;
  lastErrorCode: string | null;
  canRetry: boolean;
};
