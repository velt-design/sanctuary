import { createHash } from 'crypto';
import { renderQuoteReadyEmail, type QuoteReadyEmailInput } from '@/lib/emails/quote';
import type { QuoteVersionDetail } from './types';

export type QuotePreviewBasePayload = Pick<
  QuoteReadyEmailInput,
  | 'name'
  | 'quote_number'
  | 'quote_total_inc_gst'
  | 'project_address'
  | 'quote_accept_link'
  | 'quote_valid_until'
  | 'next_step_text'
  | 'logo_url'
  | 'reference_id'
> & {
  default_subject: string;
};

export type QuotePreviewRenderPayload = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  personalNote?: string | null;
  bodyText?: string;
};

function siteUrlRawFromEnv(): string {
  return (
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim() ||
    ''
  );
}

function normalizeSiteUrl(raw: string): string | null {
  const normalized = raw.replace(/\/+$/, '');
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function formatCurrency(cents: number): string {
  const dollars = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function personalNoteFromPayload(payload: QuotePreviewRenderPayload): string | null {
  const note =
    typeof payload.personalNote === 'string'
      ? payload.personalNote
      : typeof payload.bodyText === 'string'
        ? payload.bodyText
        : '';
  const trimmed = note.trim();
  return trimmed ? trimmed : null;
}

function personalNoteHtml(note: string | null): string | undefined {
  if (!note) return undefined;
  return escapeHtml(note).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '<br />');
}

export function quoteNumber(detail: QuoteVersionDetail): string {
  return `${detail.quoteRef} v${detail.versionNumber}`;
}

export function quoteDefaultSubject(value: string): string {
  return `Quote ready - ${value}`;
}

export function safeSiteUrl(): string | null {
  const raw = siteUrlRawFromEnv();
  if (!raw) return null;
  return normalizeSiteUrl(raw);
}

export function quoteLogoUrl(): string | undefined {
  const base = safeSiteUrl();
  if (!base) return undefined;
  return `${base}/images/sp_dark_icon.png`;
}

export function previewQuoteAcceptLink(quoteVersionId: string): string {
  const base = safeSiteUrl();
  const id = encodeURIComponent(quoteVersionId);
  if (!base) return `https://preview.invalid/quote/${id}?token=preview`;
  return `${base}/quote/${id}?token=preview`;
}

export function renderExpiresLabel(expiresAtDate: string | null): string | undefined {
  if (!expiresAtDate) return undefined;
  const parsed = new Date(`${expiresAtDate}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return expiresAtDate;

  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

export function buildQuoteRenderHash(detail: QuoteVersionDetail): string {
  const source = JSON.stringify({
    id: detail.id,
    status: detail.status,
    quoteRef: detail.quoteRef,
    versionNumber: detail.versionNumber,
    sentAt: detail.sentAt ?? null,
    sentBy: detail.sentBy ?? null,
    expiresAt: detail.expiresAt ?? null,
    reference: detail.reference ?? null,
    customerName: detail.customerName ?? null,
    introText: detail.introText ?? null,
    termsText: detail.termsText ?? null,
    depositPercent: detail.depositPercent,
    totals: detail.totals,
    contact: detail.contact,
    project: detail.project,
    lineItems: detail.lineItems.map((item) => ({
      description: item.description,
      qty: item.qty,
      unitPriceIncGstCents: item.unitPriceIncGstCents,
      lineTotalIncGstCents: item.lineTotalIncGstCents,
      sortOrder: item.sortOrder,
    })),
  });

  return createHash('sha256').update(source).digest('hex');
}

export function buildQuotePreviewBasePayload(params: {
  detail: QuoteVersionDetail;
  quoteAcceptUrl: string;
  expiresAtLabel?: string;
  logoUrl?: string;
}): QuotePreviewBasePayload {
  const quoteNumberValue = quoteNumber(params.detail);

  return {
    name: params.detail.customerName || params.detail.contact.name || 'there',
    quote_number: quoteNumberValue,
    quote_total_inc_gst: formatCurrency(params.detail.totals.totalIncGstCents),
    project_address: params.detail.project.siteAddress ?? undefined,
    quote_accept_link: params.quoteAcceptUrl,
    quote_valid_until: params.expiresAtLabel,
    next_step_text: 'Use the button above to accept the quote and proceed.',
    logo_url: params.logoUrl,
    reference_id: params.detail.reference ?? params.detail.project.quoteRef ?? undefined,
    default_subject: quoteDefaultSubject(quoteNumberValue),
  };
}

export function isQuotePreviewBasePayload(value: unknown): value is QuotePreviewBasePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.quote_number === 'string' && typeof record.quote_total_inc_gst === 'string';
}

export async function renderQuotePreviewFromBasePayload(
  base: QuotePreviewBasePayload,
  payload: QuotePreviewRenderPayload,
): Promise<{ subject: string; html: string; text: string | null }> {
  const note = personalNoteFromPayload(payload);
  const explicitSubject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const subject = explicitSubject || base.default_subject;
  const rendered = await renderQuoteReadyEmail({
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject,
    name: base.name,
    quote_number: base.quote_number,
    quote_total_inc_gst: base.quote_total_inc_gst,
    project_address: base.project_address,
    quote_accept_link: base.quote_accept_link,
    quote_valid_until: base.quote_valid_until,
    next_step_text: base.next_step_text,
    personal_note_html: personalNoteHtml(note),
    logo_url: base.logo_url,
    reference_id: base.reference_id,
  });

  return {
    subject,
    html: rendered.html,
    text: rendered.text ?? null,
  };
}
