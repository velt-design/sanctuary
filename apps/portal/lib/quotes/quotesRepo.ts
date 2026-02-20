import { ApiError, apiJson } from '@/lib/repo/apiClient';
import type { QuoteVersion, QuoteVersionDetail } from './types';

type QuoteSendPayload = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  personalNote?: string | null;
  bodyText?: string;
  bodyHtml?: string | null;
  designPdf?: File | null;
};

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function hasDesignPdf(payload: QuoteSendPayload): payload is QuoteSendPayload & { designPdf: File } {
  return typeof File !== 'undefined' && payload.designPdf instanceof File && payload.designPdf.size > 0;
}

function appendOptionalCsv(form: FormData, key: string, values: string[] | undefined): void {
  const list = Array.isArray(values) ? values.map((value) => String(value ?? '').trim()).filter(Boolean) : [];
  if (!list.length) return;
  form.append(key, list.join(', '));
}

async function postQuoteSendMultipart(path: string, payload: QuoteSendPayload): Promise<QuoteVersionDetail> {
  if (!hasDesignPdf(payload)) throw new Error('Design PDF missing from multipart payload');

  const form = new FormData();
  form.append('to', payload.to.join(', '));
  appendOptionalCsv(form, 'cc', payload.cc);
  appendOptionalCsv(form, 'bcc', payload.bcc);
  form.append('subject', payload.subject);
  if (typeof payload.personalNote === 'string') form.append('personalNote', payload.personalNote);
  if (typeof payload.bodyText === 'string') form.append('bodyText', payload.bodyText);
  if (typeof payload.bodyHtml === 'string') form.append('bodyHtml', payload.bodyHtml);
  form.append('design_pdf', payload.designPdf);

  const res = await fetch(path, {
    method: 'POST',
    body: form,
    cache: 'no-store',
    credentials: 'same-origin',
  });

  const body = await parseJsonSafe(res);
  if (!res.ok) {
    const msg = typeof (body as any)?.error === 'string' ? String((body as any).error) : `Request failed (${res.status})`;
    throw new ApiError(msg, { status: res.status, body });
  }
  const quoteVersion = (body as any)?.quoteVersion as QuoteVersionDetail | undefined;
  if (!quoteVersion) throw new Error('Failed to send quote');
  return quoteVersion;
}

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
  payload: QuoteSendPayload,
): Promise<QuoteVersionDetail> {
  const path = `/api/quotes/${encodeURIComponent(quoteVersionId)}/send`;
  if (hasDesignPdf(payload)) {
    return postQuoteSendMultipart(path, payload);
  }
  const { designPdf: _designPdf, ...jsonPayload } = payload;
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}/send`, {
    method: 'POST',
    body: JSON.stringify(jsonPayload),
  });
  if (!res.quoteVersion) throw new Error('Failed to send quote');
  return res.quoteVersion;
}

export async function resendQuote(
  quoteVersionId: string,
  payload: QuoteSendPayload,
): Promise<QuoteVersionDetail> {
  const path = `/api/quotes/${encodeURIComponent(quoteVersionId)}/resend`;
  if (hasDesignPdf(payload)) {
    return postQuoteSendMultipart(path, payload);
  }
  const { designPdf: _designPdf, ...jsonPayload } = payload;
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}/resend`, {
    method: 'POST',
    body: JSON.stringify(jsonPayload),
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
