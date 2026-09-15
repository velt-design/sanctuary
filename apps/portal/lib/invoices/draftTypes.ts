import type { InvoiceContentSnapshot } from '@sp/quote-format';
import type { AdminInvoiceCreateInput } from './types';

export type InvoiceDraft = {
  id: string;
  projectId: string;
  quoteVersionId: string | null;
  revision: number;
  content: InvoiceContentSnapshot;
  options: Omit<AdminInvoiceCreateInput, 'projectId' | 'quoteVersionId' | 'sendNow' | 'clientIntentId'>;
  scopeTotalIncGstCents: number;
  amountIncGstCents: number;
};

export type InvoiceDraftList = { enabled: boolean; drafts: InvoiceDraft[] };
