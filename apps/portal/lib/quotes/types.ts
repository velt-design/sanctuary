export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED';

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
  quoteRef: string;
  versionNumber: number;
  status: QuoteStatus;
  depositPercent: number;
  sourceEstimateVersionId: string;
  sourceEstimateVersionLabel: string;
  revisedFromQuoteVersionId?: string | null;
  createdAt: string;
  createdBy?: string | null;
  sentAt?: string | null;
  sentBy?: string | null;
  expiresAt?: string | null;
  reference?: string | null;
  customerName?: string | null;
  introText?: string | null;
  termsText?: string | null;
  totals: QuoteTotals;
  pdfFileId?: string | null;
  renderHash?: string | null;
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
};

type QuoteAcceptanceInvoice = {
  id: string;
  invoiceRef: string;
  sent: boolean;
  sendError: string | null;
};

export type QuoteAcceptResult = {
  quoteVersion: QuoteVersionDetail;
  invoice: QuoteAcceptanceInvoice | null;
};
