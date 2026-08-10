import { createHash } from 'crypto';
import { renderQuoteReadyEmail, type QuoteReadyEmailInput } from '@/lib/emails/quote';
import type { QuoteVersionDetail } from './types';

const QUOTE_ARTIFACT_RENDER_VERSION = 'sanctuary-editorial-v2';

export type QuotePreviewBasePayload = Pick<
  QuoteReadyEmailInput,
  | 'name'
  | 'quote_number'
  | 'project_name'
  | 'quote_subtotal_ex_gst'
  | 'quote_gst'
  | 'quote_total_inc_gst'
  | 'project_address'
  | 'quote_accept_link'
  | 'quote_valid_until'
  | 'deposit_percent'
  | 'next_step_text'
  | 'logo_url'
  | 'reference_id'
> & {
  default_subject: string;
};

type QuotePreviewRenderPayload = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  personalNote?: string | null;
  bodyText?: string;
  attachmentNames?: string[];
  attachments?: Array<{ filename: string }>;
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

function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
  return safe
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

function attachmentNamesFromPayload(payload: QuotePreviewRenderPayload): string[] {
  const explicit = Array.isArray(payload.attachmentNames) ? payload.attachmentNames : [];
  const attached = Array.isArray(payload.attachments)
    ? payload.attachments.map((attachment) => attachment.filename)
    : [];
  return [...explicit, ...attached]
    .map((filename) => String(filename ?? '').trim().replace(/[\\/:*?"<>|]+/g, '_'))
    .filter(Boolean)
    .filter((filename, index, values) => values.indexOf(filename) === index);
}

export function quoteNumber(detail: QuoteVersionDetail): string {
  return `${detail.quoteRef} v${detail.versionNumber}`;
}

function quoteDefaultSubject(value: string): string {
  return `Quote ready - ${value}`;
}

function safeSiteUrl(): string | null {
  const raw = siteUrlRawFromEnv();
  if (!raw) return null;
  return normalizeSiteUrl(raw);
}

export function quoteLogoUrl(): string | undefined {
  const base = safeSiteUrl();
  if (!base) return undefined;
  return `${base}/images/email-logo.png`;
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
    artifactVersion: QUOTE_ARTIFACT_RENDER_VERSION,
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
    paymentTerms: detail.paymentTerms ?? null,
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
  const firstPayment = params.detail.paymentTerms?.[0];
  const firstPaymentDescription = firstPayment
    ? `${firstPayment.label} (${formatCurrency(firstPayment.resolvedAmountIncGstCents)})`
    : `${formatPercent(params.detail.depositPercent)}% initial payment`;

  return {
    name: params.detail.customerName || params.detail.contact.name || 'there',
    quote_number: quoteNumberValue,
    project_name: params.detail.project.name || undefined,
    quote_subtotal_ex_gst: formatCurrency(params.detail.totals.totalExGstCents),
    quote_gst: formatCurrency(params.detail.totals.gstCents),
    quote_total_inc_gst: formatCurrency(params.detail.totals.totalIncGstCents),
    project_address: params.detail.project.siteAddress ?? undefined,
    quote_accept_link: params.quoteAcceptUrl,
    quote_valid_until: params.expiresAtLabel,
    deposit_percent: firstPayment?.calculationType === 'fixed'
      ? undefined
      : formatPercent(firstPayment?.percentageOfRemainder ?? params.detail.depositPercent),
    next_step_text:
      `If you accept, we will issue the first scheduled invoice for ${firstPaymentDescription}. No payment is due with this quote.`,
    logo_url: params.logoUrl,
    reference_id: params.detail.reference ?? params.detail.project.quoteRef ?? undefined,
    default_subject: quoteDefaultSubject(quoteNumberValue),
  };
}

export function isQuotePreviewBasePayload(value: unknown): value is QuotePreviewBasePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.quote_number === 'string' &&
    typeof record.quote_subtotal_ex_gst === 'string' &&
    typeof record.quote_gst === 'string' &&
    typeof record.quote_total_inc_gst === 'string' &&
    typeof record.deposit_percent === 'string'
  );
}

export function parseQuotePreviewBasePayload(value: unknown): QuotePreviewBasePayload | null {
  if (!isQuotePreviewBasePayload(value)) return null;
  const record = value as unknown as Record<string, unknown>;

  return {
    name: typeof record.name === 'string' ? record.name : 'there',
    quote_number: value.quote_number,
    project_name: typeof record.project_name === 'string' ? record.project_name : undefined,
    quote_subtotal_ex_gst: value.quote_subtotal_ex_gst,
    quote_gst: value.quote_gst,
    quote_total_inc_gst: value.quote_total_inc_gst,
    project_address: typeof record.project_address === 'string' ? record.project_address : undefined,
    quote_accept_link: typeof record.quote_accept_link === 'string' ? record.quote_accept_link : 'https://preview.invalid',
    quote_valid_until: typeof record.quote_valid_until === 'string' ? record.quote_valid_until : undefined,
    deposit_percent: value.deposit_percent,
    next_step_text:
      typeof record.next_step_text === 'string'
        ? record.next_step_text
        : 'If you accept, we will issue your deposit invoice with payment details. No payment is due with this quote.',
    logo_url: typeof record.logo_url === 'string' ? record.logo_url : undefined,
    reference_id: typeof record.reference_id === 'string' ? record.reference_id : undefined,
    default_subject:
      typeof record.default_subject === 'string' && record.default_subject.trim()
        ? record.default_subject
        : `Quote ready - ${value.quote_number}`,
  };
}

export async function renderQuotePreviewFromBasePayload(
  base: QuotePreviewBasePayload,
  payload: QuotePreviewRenderPayload,
): Promise<{ subject: string; html: string; text: string | null }> {
  const note = personalNoteFromPayload(payload);
  const explicitSubject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const subject = explicitSubject || base.default_subject;
  const attachmentNames = attachmentNamesFromPayload(payload);
  const rendered = await renderQuoteReadyEmail({
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject,
    name: base.name,
    quote_number: base.quote_number,
    project_name: base.project_name,
    quote_subtotal_ex_gst: base.quote_subtotal_ex_gst,
    quote_gst: base.quote_gst,
    quote_total_inc_gst: base.quote_total_inc_gst,
    project_address: base.project_address,
    quote_accept_link: base.quote_accept_link,
    quote_valid_until: base.quote_valid_until,
    deposit_percent: base.deposit_percent,
    next_step_text: base.next_step_text,
    personal_note_html: personalNoteHtml(note),
    personal_note_text: note ?? undefined,
    logo_url: base.logo_url,
    reference_id: base.reference_id,
    attachment_names: attachmentNames.length ? attachmentNames : undefined,
  });

  return {
    subject,
    html: rendered.html,
    text: rendered.text ?? null,
  };
}
