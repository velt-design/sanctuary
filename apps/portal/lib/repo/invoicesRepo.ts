import { apiJson } from '@/lib/repo/apiClient';
import type {
  AdminInvoiceCreateInput,
  DepositInvoiceArtifactPreview,
  DepositInvoiceSummary,
  ProjectInvoiceSchedule,
  QuoteInvoiceCreateResult,
} from '@/lib/invoices/types';

export async function listProjectDepositInvoices(projectId: string): Promise<DepositInvoiceSummary[]> {
  const res = await apiJson<{ invoices: DepositInvoiceSummary[] }>(`/api/staff/v1/projects/${encodeURIComponent(projectId)}/invoices`, {
    method: 'GET',
  });
  return Array.isArray(res.invoices) ? res.invoices : [];
}

export async function sendProjectDepositInvoice(invoiceId: string): Promise<DepositInvoiceSummary> {
  const res = await apiJson<{ invoice: DepositInvoiceSummary }>(`/api/staff/v1/invoices/${encodeURIComponent(invoiceId)}/send`, {
    method: 'POST',
  });
  if (!res.invoice) throw new Error('Failed to send invoice');
  return res.invoice;
}

export async function loadDepositInvoiceArtifactPreview(invoiceId: string): Promise<DepositInvoiceArtifactPreview> {
  const res = await apiJson<{ preview: DepositInvoiceArtifactPreview }>(`/api/staff/v1/invoices/${encodeURIComponent(invoiceId)}/preview`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!res.preview) throw new Error('Invoice preview is unavailable');
  return res.preview;
}

export function depositInvoicePdfPreviewUrl(invoiceId: string): string {
  return `/api/staff/v1/invoices/${encodeURIComponent(invoiceId)}/preview/pdf`;
}

export async function loadProjectInvoiceSchedule(projectId: string): Promise<ProjectInvoiceSchedule> {
  const res = await apiJson<{ schedule: ProjectInvoiceSchedule }>(`/api/staff/v1/projects/${encodeURIComponent(projectId)}/invoice-schedule`, {
    method: 'GET', cache: 'no-store',
  });
  return res.schedule;
}

export async function createProjectInvoice(input: AdminInvoiceCreateInput): Promise<QuoteInvoiceCreateResult> {
  const res = await apiJson<{ result: QuoteInvoiceCreateResult }>(`/api/admin/projects/${encodeURIComponent(input.projectId)}/invoices`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.result;
}

export async function recordProjectPayment(input: {
  projectId: string;
  entryType: 'PAYMENT' | 'ADJUSTMENT';
  amountIncGstCents: number;
  occurredAt?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;
  note?: string | null;
  reason?: string | null;
}): Promise<void> {
  await apiJson(`/api/admin/projects/${encodeURIComponent(input.projectId)}/payments`, {
    method: 'POST', body: JSON.stringify(input),
  });
}

export async function updatePaymentAllocations(input: {
  paymentEntryId: string;
  allocations: Array<{ quoteVersionId: string; paymentTermId: string; amountIncGstCents: number }>;
  reason: string;
}): Promise<void> {
  await apiJson(`/api/admin/payments/${encodeURIComponent(input.paymentEntryId)}/allocations`, {
    method: 'POST', body: JSON.stringify({ allocations: input.allocations, reason: input.reason }),
  });
}

export async function reverseProjectPayment(paymentEntryId: string, reason: string): Promise<void> {
  await apiJson(`/api/admin/payments/${encodeURIComponent(paymentEntryId)}/reverse`, {
    method: 'POST', body: JSON.stringify({ reason }),
  });
}

export async function markProjectInvoicePaid(invoiceId: string, evidence: {
  reference?: string | null;
  method?: string | null;
  note?: string | null;
} = {}): Promise<DepositInvoiceSummary> {
  const res = await apiJson<{ invoice: DepositInvoiceSummary }>(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/paid`, {
    method: 'POST', body: JSON.stringify({
      paidAt: new Date().toISOString(),
      reference: evidence.reference?.trim() || null,
      method: evidence.method?.trim() || null,
      note: evidence.note?.trim() || null,
    }),
  });
  return res.invoice;
}

export async function voidProjectInvoice(invoiceId: string, reason: string): Promise<DepositInvoiceSummary> {
  const res = await apiJson<{ invoice: DepositInvoiceSummary }>(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/void`, {
    method: 'POST', body: JSON.stringify({ reason }),
  });
  return res.invoice;
}
