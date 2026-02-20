import { apiJson } from '@/lib/repo/apiClient';
import type { QuoteVersion, QuoteVersionDetail } from './types';

export async function listQuoteVersions(projectId: string): Promise<QuoteVersion[]> {
  const res = await apiJson<{ quotes: QuoteVersion[] }>(`/api/projects/${encodeURIComponent(projectId)}/quotes`);
  return Array.isArray(res.quotes) ? res.quotes : [];
}

export async function createQuoteFromEstimate(projectId: string, estimateVersionId: string): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/projects/${encodeURIComponent(projectId)}/quotes`, {
    method: 'POST',
    body: JSON.stringify({ estimateVersionId }),
  });
  if (!res.quoteVersion) throw new Error('Failed to create quote');
  return res.quoteVersion;
}

export async function getQuoteVersion(quoteVersionId: string): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}`);
  if (!res.quoteVersion) throw new Error('Quote not found');
  return res.quoteVersion;
}

export async function updateDraftQuoteVersion(
  quoteVersionId: string,
  patch: {
    reference?: string | null;
    introText?: string | null;
    termsText?: string | null;
    depositPercent?: number;
    expiresAt?: string | null;
    lineItems?: Array<{ description: string; qty: number; unitPriceIncGstCents: number }>;
  },
): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );
  if (!res.quoteVersion) throw new Error('Failed to update quote');
  return res.quoteVersion;
}

export async function deleteDraftQuoteVersion(quoteVersionId: string): Promise<void> {
  await apiJson(`/api/quotes/${encodeURIComponent(quoteVersionId)}`, { method: 'DELETE' });
}

export async function sendQuote(
  quoteVersionId: string,
  payload: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    personalNote?: string | null;
    bodyText?: string;
    bodyHtml?: string | null;
  },
): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.quoteVersion) throw new Error('Failed to send quote');
  return res.quoteVersion;
}

export async function resendQuote(
  quoteVersionId: string,
  payload: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    personalNote?: string | null;
    bodyText?: string;
    bodyHtml?: string | null;
  },
): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}/resend`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.quoteVersion) throw new Error('Failed to resend quote');
  return res.quoteVersion;
}

export async function reviseQuote(quoteVersionId: string): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}/revise`, {
    method: 'POST',
  });
  if (!res.quoteVersion) throw new Error('Failed to revise quote');
  return res.quoteVersion;
}

export async function markQuoteAccepted(quoteVersionId: string): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}/accept`, {
    method: 'POST',
  });
  if (!res.quoteVersion) throw new Error('Failed to mark accepted');
  return res.quoteVersion;
}

export async function markQuoteDeclined(quoteVersionId: string): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}/decline`, {
    method: 'POST',
  });
  if (!res.quoteVersion) throw new Error('Failed to mark declined');
  return res.quoteVersion;
}

export function quotePdfUrl(quoteVersionId: string): string {
  return `/api/quotes/${encodeURIComponent(quoteVersionId)}/pdf`;
}
