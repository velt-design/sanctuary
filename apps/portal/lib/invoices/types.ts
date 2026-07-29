type DepositInvoiceStatus = 'OPEN' | 'VOID';

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
  lastDeliveryStatus: DepositInvoiceDeliveryStatus;
  lastDeliveryError: string | null;
  lastDeliveryAttemptAt: string | null;
  nextRetryAt: string | null;
  finalFailure: boolean;
  recipients: string[];
};

export type QuoteInvoiceCreateResult = {
  invoice: DepositInvoiceSummary;
  created: boolean;
  sent: boolean;
  alreadySent: boolean;
  sendError: string | null;
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
