import 'server-only';

import { appIdFromUuid } from '@/lib/supabase/mappers';
import { normalizeDepositPercent } from './defaults';
import { normalizeStoredQuotePaymentSchedule } from './paymentSchedule';
import { nowIso } from './serverHelpers';
import type { QuoteLineItem, QuoteSendLog, QuoteStatus, QuoteVersion } from './types';
import { normalizeCommercialInternalName } from '@/lib/commercial/internalName';
import { commercialScopeKind, normalizeCommercialScopeId } from '@/lib/commercial/scope';

function toStatus(raw: unknown): QuoteStatus {
  const value = typeof raw === 'string' ? raw.toUpperCase() : '';
  if (value === 'SENT' || value === 'ACCEPTED' || value === 'DECLINED' || value === 'SUPERSEDED') {
    return value as QuoteStatus;
  }
  return 'DRAFT';
}

function safeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

export function mapQuoteVersionRow(
  row: any,
  estimateLabelMap: Map<string, string>,
  projectIdApp: string,
): QuoteVersion {
  const quoteRef = String(row?.quotes?.quote_ref ?? row?.quote_ref ?? '');
  const estimateId = String(row?.source_estimate_version_id ?? '');
  const estimateLabelRaw = estimateId ? estimateLabelMap.get(estimateId) ?? 'V-' : 'Manual quote';
  const estimateLabel = !estimateId || estimateLabelRaw.startsWith('Estimate') || estimateLabelRaw === 'Manual quote'
    ? estimateLabelRaw
    : `Estimate ${estimateLabelRaw}`;

  const depositPercent = normalizeDepositPercent(row?.deposit_percent, 50);
  const totalIncGstCents = Number(row?.total_inc_gst_cents ?? 0) || 0;
  const commercialScopeId = normalizeCommercialScopeId(row?.quotes?.commercial_scope_id ?? row?.commercial_scope_id);

  return {
    id: appIdFromUuid('qv', String(row?.id ?? '')),
    quoteId: appIdFromUuid('qt', String(row?.quote_id ?? row?.quotes?.id ?? '')),
    projectId: projectIdApp,
    commercialScopeId,
    commercialScopeKind: commercialScopeKind(commercialScopeId),
    quoteRef,
    internalName: normalizeCommercialInternalName(row?.quotes?.internal_name ?? row?.internal_name),
    versionNumber: Number(row?.version_number ?? 0) || 0,
    status: toStatus(row?.status),
    depositPercent,
    paymentTerms: normalizeStoredQuotePaymentSchedule(row?.payment_terms, totalIncGstCents, depositPercent),
    sourceEstimateVersionId: estimateId ? appIdFromUuid('est', estimateId) : null,
    sourceEstimateVersionLabel: estimateLabel,
    revisedFromQuoteVersionId: row?.revised_from_quote_version_id
      ? appIdFromUuid('qv', String(row.revised_from_quote_version_id))
      : null,
    createdAt: typeof row?.created_at === 'string' ? row.created_at : nowIso(),
    updatedAt: typeof row?.updated_at === 'string' ? row.updated_at : nowIso(),
    commercialRevision:
      Number.isSafeInteger(Number(row?.commercial_revision)) &&
      Number(row?.commercial_revision) > 0
        ? Number(row.commercial_revision)
        : 1,
    isCurrentDraft:
      toStatus(row?.status) === 'DRAFT' && row?.is_current_draft === true,
    deliveryPreparedAt:
      typeof row?.delivery_prepared_at === 'string'
        ? row.delivery_prepared_at
        : null,
    createdBy: typeof row?.created_by === 'string' ? row.created_by : null,
    sentAt: typeof row?.sent_at === 'string' ? row.sent_at : null,
    sentBy: typeof row?.sent_by === 'string' ? row.sent_by : null,
    acceptedAt: typeof row?.accepted_at === 'string' ? row.accepted_at : null,
    supersededAt: typeof row?.superseded_at === 'string' ? row.superseded_at : null,
    supersededBy: typeof row?.superseded_by === 'string' ? row.superseded_by : null,
    expiresAt: typeof row?.expires_at === 'string' ? row.expires_at : null,
    reference: typeof row?.reference === 'string' ? row.reference : null,
    customerName:
      typeof row?.customer_name === 'string' && row.customer_name.trim() ? row.customer_name.trim() : null,
    introText: typeof row?.intro_text === 'string' ? row.intro_text : null,
    termsText: typeof row?.terms_text === 'string' ? row.terms_text : null,
    totals: {
      totalIncGstCents,
      totalExGstCents: Number(row?.total_ex_gst_cents ?? 0) || 0,
      gstCents: Number(row?.gst_cents ?? 0) || 0,
    },
    pdfFileId: row?.pdf_file_id ? appIdFromUuid('file', String(row.pdf_file_id)) : null,
    renderHash: typeof row?.render_hash === 'string' && row.render_hash.trim() ? row.render_hash.trim() : null,
    pricingSource: String(row?.pricing_source ?? '').trim() === 'manual'
      ? 'manual'
      : String(row?.pricing_source ?? '').trim() === 'workbench_solved'
        ? 'workbench_solved'
        : 'calculator_live',
  };
}

export function mapLineItemRow(row: any): QuoteLineItem {
  return {
    id: appIdFromUuid('qli', String(row?.id ?? '')),
    description: String(row?.description ?? ''),
    qty: typeof row?.qty === 'number' ? row.qty : Number(row?.qty ?? 0) || 0,
    unitPriceIncGstCents: Number(row?.unit_price_inc_gst_cents ?? 0) || 0,
    lineTotalIncGstCents: Number(row?.line_total_inc_gst_cents ?? 0) || 0,
    sortOrder: Number(row?.sort_order ?? 0) || 0,
  };
}

export function mapSendLogRow(row: any): QuoteSendLog {
  return {
    id: appIdFromUuid('qsl', String(row?.id ?? '')),
    projectId: appIdFromUuid('proj', String(row?.project_id ?? '')),
    quoteVersionId: appIdFromUuid('qv', String(row?.quote_version_id ?? '')),
    fromName: typeof row?.from_name === 'string' ? row.from_name : null,
    fromEmail: typeof row?.from_email === 'string' ? row.from_email : null,
    replyToEmail: typeof row?.reply_to_email === 'string' ? row.reply_to_email : null,
    to: safeStringArray(row?.to_emails),
    cc: safeStringArray(row?.cc_emails),
    bcc: safeStringArray(row?.bcc_emails),
    subject: String(row?.subject ?? ''),
    bodyHtml: typeof row?.body_html === 'string' ? row.body_html : null,
    bodyText: typeof row?.body_text === 'string' ? row.body_text : null,
    attachments: safeStringArray(row?.attachment_file_ids),
    provider: typeof row?.provider === 'string' ? row.provider : null,
    providerMessageId: typeof row?.provider_message_id === 'string' ? row.provider_message_id : null,
    status: String(row?.status ?? 'FAILED').toUpperCase() === 'SENT' ? 'SENT' : 'FAILED',
    errorMessage: typeof row?.error_message === 'string' ? row.error_message : null,
    createdAt: typeof row?.created_at === 'string' ? row.created_at : nowIso(),
    createdBy: typeof row?.created_by === 'string' ? row.created_by : null,
    sentAt: typeof row?.sent_at === 'string' ? row.sent_at : null,
  };
}
