import { ApiError, apiJson } from '@/lib/repo/apiClient';
import type { QuoteInvoiceCreateResult } from '@/lib/invoices/types';
import type { QuoteAcceptResult, QuoteVersion, QuoteVersionDetail } from './types';
import type { QuoteRefreshMode, QuoteRefreshPreview } from './refresh';

type QuoteSendPayload = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  personalNote?: string | null;
  bodyText?: string;
  bodyHtml?: string | null;
  attachments?: File[] | null;
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

function hasAttachments(payload: QuoteSendPayload): payload is QuoteSendPayload & { attachments: File[] } {
  if (typeof File === 'undefined') return false;
  if (!Array.isArray(payload.attachments)) return false;
  return payload.attachments.some((entry) => entry instanceof File && entry.size > 0);
}

function appendOptionalCsv(form: FormData, key: string, values: string[] | undefined): void {
  const list = Array.isArray(values) ? values.map((value) => String(value ?? '').trim()).filter(Boolean) : [];
  if (!list.length) return;
  form.append(key, list.join(', '));
}

async function postQuoteSendMultipart(path: string, payload: QuoteSendPayload): Promise<QuoteVersionDetail> {
  if (!hasAttachments(payload)) throw new Error('Attachments missing from multipart payload');

  const form = new FormData();
  form.append('to', payload.to.join(', '));
  appendOptionalCsv(form, 'cc', payload.cc);
  appendOptionalCsv(form, 'bcc', payload.bcc);
  form.append('subject', payload.subject);
  if (typeof payload.personalNote === 'string') form.append('personalNote', payload.personalNote);
  if (typeof payload.bodyText === 'string') form.append('bodyText', payload.bodyText);
  if (typeof payload.bodyHtml === 'string') form.append('bodyHtml', payload.bodyHtml);
  for (const file of payload.attachments) {
    if (file instanceof File && file.size > 0) {
      form.append('attachments', file, file.name);
    }
  }

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

export async function getQuoteVersion(quoteVersionId: string): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}`);
  if (!res.quoteVersion) throw new Error('Quote not found');
  return res.quoteVersion;
}

export async function refreshDraftQuoteFromEstimate(
  quoteVersionId: string,
  estimateVersionId: string,
  mode: QuoteRefreshMode = 'full_rebuild',
): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(
    `/api/quotes/${encodeURIComponent(quoteVersionId)}/refresh-from-estimate`,
    {
      method: 'POST',
      body: JSON.stringify({ estimateVersionId, mode }),
    },
  );
  if (!res.quoteVersion) throw new Error('Failed to refresh quote');
  return res.quoteVersion;
}

export async function previewDraftQuoteRefreshFromEstimate(
  quoteVersionId: string,
  estimateVersionId: string,
  mode: QuoteRefreshMode,
): Promise<QuoteRefreshPreview> {
  const res = await apiJson<{ preview: QuoteRefreshPreview }>(
    `/api/quotes/${encodeURIComponent(quoteVersionId)}/refresh-from-estimate`,
    {
      method: 'POST',
      body: JSON.stringify({ estimateVersionId, mode, dryRun: true }),
    },
  );
  if (!res.preview) throw new Error('Failed to preview quote refresh');
  return res.preview;
}

export async function deleteDraftQuoteVersion(quoteVersionId: string): Promise<void> {
  await apiJson(`/api/quotes/${encodeURIComponent(quoteVersionId)}`, { method: 'DELETE' });
}

export async function sendQuote(
  quoteVersionId: string,
  payload: QuoteSendPayload,
): Promise<QuoteVersionDetail> {
  const path = `/api/quotes/${encodeURIComponent(quoteVersionId)}/send`;
  if (hasAttachments(payload)) {
    return postQuoteSendMultipart(path, payload);
  }
  const { attachments: _attachments, ...jsonPayload } = payload;
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
  if (hasAttachments(payload)) {
    return postQuoteSendMultipart(path, payload);
  }
  const { attachments: _attachments, ...jsonPayload } = payload;
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}/resend`, {
    method: 'POST',
    body: JSON.stringify(jsonPayload),
  });
  if (!res.quoteVersion) throw new Error('Failed to resend quote');
  return res.quoteVersion;
}

export async function previewQuotePdf(
  quoteVersion: QuoteVersionDetail,
  opts?: { signal?: AbortSignal },
): Promise<Uint8Array> {
  const res = await fetch('/api/quotes/preview-pdf', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ quoteVersion }),
    cache: 'no-store',
    credentials: 'same-origin',
    signal: opts?.signal,
  });

  if (!res.ok) {
    const body = await parseJsonSafe(res);
    const msg = typeof (body as any)?.error === 'string' ? String((body as any).error) : `Failed to render quote preview (${res.status})`;
    throw new ApiError(msg, { status: res.status, body });
  }

  return new Uint8Array(await res.arrayBuffer());
}

export async function reviseQuote(quoteVersionId: string): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}/revise`, {
    method: 'POST',
  });
  if (!res.quoteVersion) throw new Error('Failed to revise quote');
  return res.quoteVersion;
}

export async function markQuoteAccepted(quoteVersionId: string): Promise<QuoteAcceptResult> {
  const res = await apiJson<QuoteAcceptResult>(`/api/quotes/${encodeURIComponent(quoteVersionId)}/accept`, {
    method: 'POST',
  });
  if (!res.quoteVersion) throw new Error('Failed to mark accepted');
  return res;
}

export async function markQuoteDeclined(quoteVersionId: string): Promise<QuoteVersionDetail> {
  const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(quoteVersionId)}/decline`, {
    method: 'POST',
  });
  if (!res.quoteVersion) throw new Error('Failed to mark declined');
  return res.quoteVersion;
}

export async function createQuoteInvoice(
  quoteVersionId: string,
  payload: {
    depositPercent?: number;
    dueDate?: string | null;
    reference?: string | null;
    sendNow?: boolean;
  },
): Promise<QuoteInvoiceCreateResult> {
  const res = await apiJson<QuoteInvoiceCreateResult>(`/api/staff/v1/quotes/${encodeURIComponent(quoteVersionId)}/invoice`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.invoice) throw new Error('Failed to create invoice');
  return res;
}

export function quotePdfUrl(quoteVersionId: string, opts?: { inline?: boolean }): string {
  const base = `/api/quotes/${encodeURIComponent(quoteVersionId)}/pdf`;
  if (!opts?.inline) return base;
  return `${base}?disposition=inline`;
}
