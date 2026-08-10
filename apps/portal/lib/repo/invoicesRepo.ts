import { apiJson } from '@/lib/repo/apiClient';
import type { DepositInvoiceArtifactPreview, DepositInvoiceSummary, ProjectInvoiceSchedule, QuoteInvoiceCreateResult } from '@/lib/invoices/types';

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
  const res = await apiJson<{ schedule: ProjectInvoiceSchedule }>(`/api/admin/projects/${encodeURIComponent(projectId)}/invoices`, {
    method: 'GET', cache: 'no-store',
  });
  return res.schedule;
}

export async function createProjectScheduledInvoice(input: {
  projectId: string;
  quoteVersionId: string;
  paymentTermId: string;
}): Promise<QuoteInvoiceCreateResult> {
  const res = await apiJson<{ result: QuoteInvoiceCreateResult }>(`/api/admin/projects/${encodeURIComponent(input.projectId)}/invoices`, {
    method: 'POST',
    body: JSON.stringify({ quoteVersionId: input.quoteVersionId, paymentTermId: input.paymentTermId }),
  });
  return res.result;
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
