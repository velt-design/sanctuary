import { apiJson } from '@/lib/repo/apiClient';
import type { DepositInvoiceSummary } from '@/lib/invoices/types';

export async function listProjectDepositInvoices(projectId: string): Promise<DepositInvoiceSummary[]> {
  const res = await apiJson<{ invoices: DepositInvoiceSummary[] }>(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/invoices`,
    { method: 'GET' },
  );
  return Array.isArray(res.invoices) ? res.invoices : [];
}

export async function sendProjectDepositInvoice(invoiceId: string): Promise<DepositInvoiceSummary> {
  const res = await apiJson<{ invoice: DepositInvoiceSummary }>(
    `/api/staff/v1/invoices/${encodeURIComponent(invoiceId)}/send`,
    { method: 'POST' },
  );
  if (!res.invoice) throw new Error('Failed to send invoice');
  return res.invoice;
}

