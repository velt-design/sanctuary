import 'server-only';

import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabaseClient';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { buildVersionLabelMap } from '@/lib/estimates/server';
import type { Estimate } from '@/lib/types/estimate';
import type { QuoteAcceptResult, QuoteLineItem, QuoteSendLog, QuoteStatus, QuoteVersion, QuoteVersionDetail } from './types';
import {
  DEFAULT_QUOTE_INTRO,
  DEFAULT_QUOTE_TERMS,
  applyDepositPercentToTerms,
  normalizeDepositPercent,
} from './defaults';
import { buildQuoteLineItemsFromEstimate } from './mapping';
import { buildQuoteRefreshPreview, type QuoteRefreshMode, type QuoteRefreshPreview } from './refresh';
import { lineTotalCents, totalsFromLineItems } from './utils';
import { generateQuotePdfBytes, quotePdfFilename } from './pdf';
import {
  buildQuotePreviewBasePayload,
  buildQuoteRenderHash,
  previewQuoteAcceptLink,
  quoteLogoUrl,
  renderExpiresLabel,
  type QuotePreviewBasePayload,
} from './renderArtifacts';
import { ensureDepositInvoiceForAcceptedQuote, voidOpenDepositInvoiceForQuote } from '../invoices/server';

export function nowIso(): string {
  return new Date().toISOString();
}

function toStatus(raw: unknown): QuoteStatus {
  const value = typeof raw === 'string' ? raw.toUpperCase() : '';
  if (value === 'SENT' || value === 'ACCEPTED' || value === 'DECLINED') return value as QuoteStatus;
  return 'DRAFT';
}

function toDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value.slice(0, 10);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  if (!Number.isFinite(d.getTime())) return dateIso;
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnly(d.toISOString());
}

function safeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

function firstTrimmedString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const message = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
  if (message) return message;
  const alt = typeof (error as any)?.error === 'string' ? String((error as any).error) : '';
  return alt || fallback;
}

function missingTableError(error: any): boolean {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  return (
    code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('relation') ||
    message.includes('function')
  );
}

function schemaMissingError(): Error {
  return new Error('Quote schema not installed. Apply migrations and restart.');
}

export async function insertAuditEvent(params: { projectId: string; type: string; payload?: unknown }) {
  try {
    await supabaseServer.from('audit_events').insert({
      project_id: params.projectId,
      type: params.type,
      idempotency_key: `${params.type}:${params.projectId}:${randomUUID()}`,
      payload: params.payload ?? {},
    } as any);
  } catch (err: any) {
    if (missingTableError(err)) return;
    console.error('[quote_audit] failed to insert', err);
  }
}

export async function updateProjectStage(projectUuid: string, toStage: string, quoteId?: string | null) {
  const prev = await supabaseServer.from('projects').select('pipeline_stage').eq('id', projectUuid).single();
  const fromStage = typeof prev.data?.pipeline_stage === 'string' ? prev.data.pipeline_stage : null;

  const updateRes = await supabaseServer
    .from('projects')
    .update({ pipeline_stage: toStage } as any)
    .eq('id', projectUuid)
    .select('id')
    .single();

  if (updateRes.error) throw updateRes.error;

  await insertAuditEvent({
    projectId: projectUuid,
    type: 'pipeline.stage_changed',
    payload: { fromStage, toStage, quoteId },
  });
}

function mapQuoteVersionRow(row: any, estimateLabelMap: Map<string, string>, projectIdApp: string): QuoteVersion {
  const quoteRef = String(row?.quotes?.quote_ref ?? row?.quote_ref ?? '');
  const estimateId = String(row?.source_estimate_version_id ?? '');
  const estimateLabelRaw = estimateLabelMap.get(estimateId) ?? 'V-';
  const estimateLabel = estimateLabelRaw.startsWith('Estimate') ? estimateLabelRaw : `Estimate ${estimateLabelRaw}`;

  return {
    id: appIdFromUuid('qv', String(row?.id ?? '')),
    quoteId: appIdFromUuid('qt', String(row?.quote_id ?? row?.quotes?.id ?? '')),
    projectId: projectIdApp,
    quoteRef,
    versionNumber: Number(row?.version_number ?? 0) || 0,
    status: toStatus(row?.status),
    depositPercent: normalizeDepositPercent(row?.deposit_percent, 50),
    sourceEstimateVersionId: appIdFromUuid('est', estimateId),
    sourceEstimateVersionLabel: estimateLabel,
    revisedFromQuoteVersionId: row?.revised_from_quote_version_id ? appIdFromUuid('qv', String(row.revised_from_quote_version_id)) : null,
    createdAt: typeof row?.created_at === 'string' ? row.created_at : nowIso(),
    createdBy: typeof row?.created_by === 'string' ? row.created_by : null,
    sentAt: typeof row?.sent_at === 'string' ? row.sent_at : null,
    sentBy: typeof row?.sent_by === 'string' ? row.sent_by : null,
    expiresAt: typeof row?.expires_at === 'string' ? row.expires_at : null,
    reference: typeof row?.reference === 'string' ? row.reference : null,
    customerName: typeof row?.customer_name === 'string' && row.customer_name.trim() ? row.customer_name.trim() : null,
    introText: typeof row?.intro_text === 'string' ? row.intro_text : null,
    termsText: typeof row?.terms_text === 'string' ? row.terms_text : null,
    totals: {
      totalIncGstCents: Number(row?.total_inc_gst_cents ?? 0) || 0,
      totalExGstCents: Number(row?.total_ex_gst_cents ?? 0) || 0,
      gstCents: Number(row?.gst_cents ?? 0) || 0,
    },
    pdfFileId: row?.pdf_file_id ? appIdFromUuid('file', String(row.pdf_file_id)) : null,
    renderHash: typeof row?.render_hash === 'string' && row.render_hash.trim() ? row.render_hash.trim() : null,
  };
}

function mapLineItemRow(row: any): QuoteLineItem {
  return {
    id: appIdFromUuid('qli', String(row?.id ?? '')),
    description: String(row?.description ?? ''),
    qty: typeof row?.qty === 'number' ? row.qty : Number(row?.qty ?? 0) || 0,
    unitPriceIncGstCents: Number(row?.unit_price_inc_gst_cents ?? 0) || 0,
    lineTotalIncGstCents: Number(row?.line_total_inc_gst_cents ?? 0) || 0,
    sortOrder: Number(row?.sort_order ?? 0) || 0,
  };
}

function mapSendLogRow(row: any): QuoteSendLog {
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

async function loadEstimateLabels(projectUuid: string): Promise<Map<string, string>> {
  const res = await supabaseServer
    .from('estimates')
    .select('id, created_at, outputs')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });

  if (res.error) {
    if (missingTableError(res.error)) return new Map();
    return new Map();
  }
  return buildVersionLabelMap(Array.isArray(res.data) ? res.data : []);
}

async function loadProjectCustomerName(projectUuid: string): Promise<string | null> {
  const res = await supabaseServer
    .from('projects')
    .select('contacts ( name )')
    .eq('id', projectUuid)
    .maybeSingle();

  if (res.error || !res.data) return null;

  const row = res.data as any;
  const contactRow = Array.isArray(row?.contacts) ? row.contacts[0] : row?.contacts ?? null;
  const customerName = typeof contactRow?.name === 'string' ? contactRow.name.trim() : '';
  return customerName || null;
}

async function loadEstimate(estimateUuid: string): Promise<Estimate | null> {
  const res = await supabaseServer.from('estimates').select('*').eq('id', estimateUuid).maybeSingle();
  if (res.error || !res.data) return null;

  const row = res.data as any;
  return {
    id: appIdFromUuid('est', String(row.id ?? '')),
    projectId: appIdFromUuid('proj', String(row.project_id ?? '')),
    createdAt: typeof row.created_at === 'string' ? row.created_at : nowIso(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    status: String(row.status ?? 'draft') as any,
    inputs: row.inputs ?? {},
    derived: (row.outputs as any)?.derived ?? {},
    outputs: {
      materials: (row.outputs as any)?.materials ?? { lines: [], totals: { materials_ex_gst: 0 } },
      install: (row.outputs as any)?.install ?? { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
      overhead: (row.outputs as any)?.overhead ?? { total_ex_gst: 0 },
      totals: (row.outputs as any)?.totals ?? { cost_ex_gst: 0, cost_inc_gst: 0, warnings: [], notes_and_warnings: [] },
      warnings: Array.isArray(row.warnings) ? row.warnings : [],
      cost_snapshot_version: (row.outputs as any)?.cost_snapshot_version === 'v2' ? 'v2' : 'v1',
      pergolas: Array.isArray((row.outputs as any)?.pergolas) ? (row.outputs as any).pergolas : undefined,
      siteShared:
        (row.outputs as any)?.siteShared && typeof (row.outputs as any).siteShared === 'object'
          ? (row.outputs as any).siteShared
          : (row.outputs as any)?.shared && typeof (row.outputs as any).shared === 'object'
            ? (row.outputs as any).shared
            : undefined,
      shared:
        (row.outputs as any)?.shared && typeof (row.outputs as any).shared === 'object'
          ? (row.outputs as any).shared
          : (row.outputs as any)?.siteShared && typeof (row.outputs as any).siteShared === 'object'
            ? (row.outputs as any).siteShared
            : undefined,
    },
    configVersions: (row.outputs as any)?.configVersions ?? {
      pricebook: '',
      installActions: '',
      overheads: '',
      rules: '',
      manifest: '',
    },
  } as Estimate;
}

async function ensureQuote(projectUuid: string, actor: string | null): Promise<{ id: string; quoteRef: string }> {
  const existing = await supabaseServer.from('quotes').select('id, quote_ref').eq('project_id', projectUuid).maybeSingle();
  if (existing.error) {
    if (missingTableError(existing.error)) throw schemaMissingError();
    throw new Error(errorMessage(existing.error, 'Failed to load quote'));
  }
  if (existing.data?.id) {
    return { id: String(existing.data.id), quoteRef: String(existing.data.quote_ref ?? '') };
  }

  const refRes = await supabaseServer.rpc('next_quote_ref');
  if (refRes.error || !refRes.data) {
    if (missingTableError(refRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(refRes.error, 'Failed to allocate quote ref'));
  }
  const quoteRef = String(refRes.data ?? '').trim();
  if (!quoteRef) throw new Error('Failed to allocate quote ref');

  const insertRes = await supabaseServer
    .from('quotes')
    .insert({ project_id: projectUuid, quote_ref: quoteRef, created_by: actor } as any)
    .select('id, quote_ref')
    .single();

  if (insertRes.error || !insertRes.data) {
    if (missingTableError(insertRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(insertRes.error, 'Failed to create quote'));
  }

  await supabaseServer
    .from('projects')
    .update({ quote_ref: quoteRef } as any)
    .eq('id', projectUuid)
    .is('quote_ref', null);

  return { id: String(insertRes.data.id), quoteRef: String(insertRes.data.quote_ref ?? quoteRef) };
}

async function nextVersionNumber(quoteUuid: string): Promise<number> {
  const res = await supabaseServer
    .from('quote_versions')
    .select('version_number')
    .eq('quote_id', quoteUuid)
    .order('version_number', { ascending: false })
    .limit(1);
  if (res.error) return 1;
  const row = Array.isArray(res.data) ? res.data[0] : null;
  const current = Number(row?.version_number ?? 0) || 0;
  return current + 1;
}

function extractEstimateText(estimate: Estimate, keys: string[]): string | null {
  for (const key of keys) {
    const value = (estimate as any)[key] ?? (estimate as any)?.outputs?.[key] ?? (estimate as any)?.inputs?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export async function syncDraftQuoteVersionsFromEstimate(
  _estimateVersionId: string,
): Promise<QuoteVersionDetail[]> {
  return [];
}

function normalizeDraftLineItems(
  lineItems: Array<{ description: string; qty: number; unitPriceIncGstCents: number }>,
): Omit<QuoteLineItem, 'id'>[] {
  return lineItems.map((item, idx) => {
    const qty = Number.isFinite(item.qty) ? item.qty : 0;
    const unitPrice = Number.isFinite(item.unitPriceIncGstCents) ? Math.round(item.unitPriceIncGstCents) : 0;
    return {
      description: String(item.description ?? ''),
      qty,
      unitPriceIncGstCents: unitPrice,
      lineTotalIncGstCents: lineTotalCents(qty, unitPrice),
      sortOrder: idx,
    };
  });
}

function totalsFromNormalizedLineItems(items: Omit<QuoteLineItem, 'id'>[]) {
  return totalsFromLineItems(
    items.map((item) => ({
      id: 'tmp',
      description: item.description,
      qty: item.qty,
      unitPriceIncGstCents: item.unitPriceIncGstCents,
      lineTotalIncGstCents: item.lineTotalIncGstCents,
      sortOrder: item.sortOrder,
    })),
  );
}

async function replaceQuoteLineItems(quoteVersionUuid: string, items: Omit<QuoteLineItem, 'id'>[]): Promise<void> {
  const deleteRes = await supabaseServer.from('quote_line_items').delete().eq('quote_version_id', quoteVersionUuid);
  if (deleteRes.error) {
    if (missingTableError(deleteRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(deleteRes.error, 'Failed to update line items'));
  }

  if (!items.length) return;

  const payload = items.map((item) => ({
    quote_version_id: quoteVersionUuid,
    sort_order: item.sortOrder,
    description: item.description,
    qty: item.qty,
    unit_price_inc_gst_cents: item.unitPriceIncGstCents,
    line_total_inc_gst_cents: item.lineTotalIncGstCents,
  }));
  const insertRes = await supabaseServer.from('quote_line_items').insert(payload as any);
  if (insertRes.error) {
    if (missingTableError(insertRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(insertRes.error, 'Failed to update line items'));
  }
}

export async function listQuoteVersionsForProject(projectId: string): Promise<QuoteVersion[]> {
  const projectUuid = uuidFromAppId(projectId, 'proj');

  const quoteRes = await supabaseServer
    .from('quotes')
    .select('id, quote_ref')
    .eq('project_id', projectUuid)
    .maybeSingle();

  if (quoteRes.error) {
    if (missingTableError(quoteRes.error)) return [];
    throw new Error(errorMessage(quoteRes.error, 'Failed to load quotes'));
  }
  if (!quoteRes.data) return [];

  const quoteUuid = String(quoteRes.data.id ?? '');
  if (!quoteUuid) return [];
  const quoteRef = String(quoteRes.data.quote_ref ?? '');

  const versionsRes = await supabaseServer
    .from('quote_versions')
    .select('*')
    .eq('quote_id', quoteUuid)
    .order('version_number', { ascending: false });

  if (versionsRes.error) {
    if (missingTableError(versionsRes.error)) return [];
    throw new Error(errorMessage(versionsRes.error, 'Failed to load quotes'));
  }

  const estimateLabels = await loadEstimateLabels(projectUuid);
  const rows = Array.isArray(versionsRes.data) ? versionsRes.data : [];
  return rows.map((row) =>
    mapQuoteVersionRow({ ...row, quotes: { quote_ref: quoteRef, id: quoteUuid } }, estimateLabels, projectId),
  );
}

export async function getQuoteVersionDetail(quoteVersionId: string): Promise<QuoteVersionDetail | null> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');

  const versionRes = await supabaseServer
    .from('quote_versions')
    .select('*, quotes!inner(id, project_id, quote_ref)')
    .eq('id', quoteVersionUuid)
    .single();

  if (versionRes.error) {
    if (missingTableError(versionRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(versionRes.error, 'Failed to load quote'));
  }
  if (!versionRes.data) return null;

  const row = versionRes.data as any;
  const projectUuid = String(row?.quotes?.project_id ?? '');
  const projectId = appIdFromUuid('proj', projectUuid);

  const [estimateLabels, lineItemsRes, logsRes, projectRes] = await Promise.all([
    loadEstimateLabels(projectUuid),
    supabaseServer.from('quote_line_items').select('*').eq('quote_version_id', quoteVersionUuid).order('sort_order', { ascending: true }),
    supabaseServer.from('quote_send_logs').select('*').eq('quote_version_id', quoteVersionUuid).order('created_at', { ascending: false }),
    supabaseServer
      .from('projects')
      .select('*, contacts ( id, name, email, phone, address )')
      .eq('id', projectUuid)
      .maybeSingle(),
  ]);

  const version = mapQuoteVersionRow(row, estimateLabels, projectId);

  const lineItems = (Array.isArray(lineItemsRes.data) ? lineItemsRes.data : []).map(mapLineItemRow);
  const sendLogs = (Array.isArray(logsRes.data) ? logsRes.data : []).map(mapSendLogRow);

  let projectRow = projectRes?.data as any;
  let contactRow = Array.isArray(projectRow?.contacts) ? projectRow.contacts[0] : projectRow?.contacts ?? null;

  // Keep quote rendering resilient to schema drift in the optional relation select above.
  if (!projectRow && projectRes?.error) {
    const fallbackProjectRes = await supabaseServer.from('projects').select('*').eq('id', projectUuid).maybeSingle();
    if (fallbackProjectRes.data) {
      projectRow = fallbackProjectRes.data as any;
      const contactId = firstTrimmedString(projectRow?.contact_id, projectRow?.contactId);
      if (contactId) {
        const fallbackContactRes = await supabaseServer.from('contacts').select('*').eq('id', contactId).maybeSingle();
        contactRow = fallbackContactRes.data as any;
      }
    }
  }

  const projectData = projectRow?.data && typeof projectRow.data === 'object' ? (projectRow.data as Record<string, unknown>) : null;
  const contactData = contactRow?.data && typeof contactRow.data === 'object' ? (contactRow.data as Record<string, unknown>) : null;
  const projectSiteAddress = firstTrimmedString(
    projectRow?.site_address,
    projectRow?.siteAddress,
    projectRow?.address,
    projectData?.site_address,
    projectData?.siteAddress,
    projectData?.address,
  );
  const contactAddress = firstTrimmedString(
    contactRow?.address,
    contactData?.address,
    contactData?.site_address,
    contactData?.siteAddress,
  );

  return {
    ...version,
    lineItems,
    sendLogs,
    contact: {
      name: firstTrimmedString(contactRow?.name) ?? '',
      email: firstTrimmedString(contactRow?.email) ?? '',
      phone: firstTrimmedString(contactRow?.phone),
    },
    project: {
      name: firstTrimmedString(projectRow?.name, projectData?.projectName, projectData?.name) ?? '',
      siteAddress: projectSiteAddress ?? contactAddress,
      region: firstTrimmedString(projectRow?.region, projectData?.region),
      quoteRef: firstTrimmedString(projectRow?.quote_ref, projectRow?.quoteRef, projectData?.quoteRef, projectData?.quote_ref),
    },
  };
}

export async function createQuoteFromEstimate(projectId: string, estimateVersionId: string, actor: string | null): Promise<QuoteVersionDetail> {
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const estimateUuid = uuidFromAppId(estimateVersionId, 'est');

  const estimate = await loadEstimate(estimateUuid);
  if (!estimate) throw new Error('Estimate not found');

  const quote = await ensureQuote(projectUuid, actor);
  const versionNumber = await nextVersionNumber(quote.id);

  const mapping = buildQuoteLineItemsFromEstimate(estimate);
  const items = mapping.items.map((item, idx) => ({ ...item, sortOrder: idx }));
  const totals = totalsFromLineItems(
    items.map((item) => ({
      id: 'tmp',
      description: item.description,
      qty: item.qty,
      unitPriceIncGstCents: item.unitPriceIncGstCents,
      lineTotalIncGstCents: item.lineTotalIncGstCents,
      sortOrder: item.sortOrder,
    })),
  );

  const introText = extractEstimateText(estimate, ['introText', 'intro_text']) ?? DEFAULT_QUOTE_INTRO;
  const depositPercent = 50;
  const termsSource = extractEstimateText(estimate, ['termsText', 'terms_text', 'terms']) ?? DEFAULT_QUOTE_TERMS;
  const termsText = applyDepositPercentToTerms(termsSource, depositPercent);
  const customerName = await loadProjectCustomerName(projectUuid);

  const insertRes = await supabaseServer
    .from('quote_versions')
    .insert({
      quote_id: quote.id,
      version_number: versionNumber,
      status: 'DRAFT',
      source_estimate_version_id: estimateUuid,
      revised_from_quote_version_id: null,
      created_by: actor,
      customer_name: customerName,
      intro_text: introText,
      terms_text: termsText,
      deposit_percent: depositPercent,
      total_inc_gst_cents: totals.totalIncGstCents,
      total_ex_gst_cents: totals.totalExGstCents,
      gst_cents: totals.gstCents,
    } as any)
    .select('*')
    .single();

  if (insertRes.error || !insertRes.data) {
    if (missingTableError(insertRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(insertRes.error, 'Failed to create quote version'));
  }

  const quoteVersionUuid = String(insertRes.data.id ?? '');

  if (items.length) {
    const payload = items.map((item) => ({
      quote_version_id: quoteVersionUuid,
      sort_order: item.sortOrder,
      description: item.description,
      qty: item.qty,
      unit_price_inc_gst_cents: item.unitPriceIncGstCents,
      line_total_inc_gst_cents: item.lineTotalIncGstCents,
    }));
    const lineRes = await supabaseServer.from('quote_line_items').insert(payload as any);
    if (lineRes.error) {
      if (missingTableError(lineRes.error)) throw schemaMissingError();
      throw new Error(errorMessage(lineRes.error, 'Failed to create line items'));
    }
  }

  await updateProjectStage(projectUuid, 'QUOTING', quoteVersionUuid);
  await insertAuditEvent({ projectId: projectUuid, type: 'quote.created', payload: { quoteVersionId: quoteVersionUuid } });

  let detail = await getQuoteVersionDetail(appIdFromUuid('qv', quoteVersionUuid));
  if (!detail) throw new Error('Failed to load quote version');
  try {
    await refreshQuoteArtifactsAfterMutation(detail.id, actor);
    detail = (await getQuoteVersionDetail(detail.id)) ?? detail;
  } catch (error) {
    console.error('[quote_artifacts] failed to refresh after create', { quoteVersionId: detail.id, error });
  }
  return detail;
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
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');

  const versionRes = await supabaseServer
    .from('quote_versions')
    .select('id, status, quote_id, terms_text, deposit_percent')
    .eq('id', quoteVersionUuid)
    .single();
  if (versionRes.error) {
    if (missingTableError(versionRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(versionRes.error, 'Quote not found'));
  }
  if (!versionRes.data) throw new Error('Quote not found');
  if (String(versionRes.data.status ?? '').toUpperCase() !== 'DRAFT') throw new Error('Quote is locked');

  const lineItems = Array.isArray(patch.lineItems) ? patch.lineItems : [];
  const normalizedLineItems = normalizeDraftLineItems(lineItems);
  const totals = totalsFromNormalizedLineItems(normalizedLineItems);

  const existingDepositPercent = normalizeDepositPercent((versionRes.data as any)?.deposit_percent, 50);
  const nextDepositPercent = patch.depositPercent === undefined
    ? existingDepositPercent
    : normalizeDepositPercent(patch.depositPercent, existingDepositPercent);

  const existingTermsText = typeof (versionRes.data as any)?.terms_text === 'string'
    ? String((versionRes.data as any).terms_text)
    : null;
  const nextTermsText = patch.termsText === null
    ? null
    : typeof patch.termsText === 'string'
      ? applyDepositPercentToTerms(patch.termsText, nextDepositPercent)
      : patch.depositPercent !== undefined
        ? applyDepositPercentToTerms(existingTermsText ?? DEFAULT_QUOTE_TERMS, nextDepositPercent)
        : undefined;

  const updatePayload: any = {
    reference: typeof patch.reference === 'string' ? patch.reference : patch.reference === null ? null : undefined,
    intro_text: typeof patch.introText === 'string' ? patch.introText : patch.introText === null ? null : undefined,
    terms_text: nextTermsText,
    deposit_percent: nextDepositPercent,
    expires_at: typeof patch.expiresAt === 'string' ? patch.expiresAt : patch.expiresAt === null ? null : undefined,
    total_inc_gst_cents: totals.totalIncGstCents,
    total_ex_gst_cents: totals.totalExGstCents,
    gst_cents: totals.gstCents,
    pdf_file_id: null,
    render_hash: null,
    preview_base_payload: null,
    preview_rendered_at: null,
  };

  Object.keys(updatePayload).forEach((key) => updatePayload[key] === undefined && delete updatePayload[key]);

  const updateRes = await supabaseServer
    .from('quote_versions')
    .update(updatePayload)
    .eq('id', quoteVersionUuid)
    .select('*')
    .single();
  if (updateRes.error || !updateRes.data) {
    if (missingTableError(updateRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(updateRes.error, 'Failed to update quote'));
  }

  await replaceQuoteLineItems(quoteVersionUuid, normalizedLineItems);

  let detail = await getQuoteVersionDetail(appIdFromUuid('qv', quoteVersionUuid));
  if (!detail) throw new Error('Failed to load quote');
  try {
    await refreshQuoteArtifactsAfterMutation(detail.id, null);
    detail = (await getQuoteVersionDetail(detail.id)) ?? detail;
  } catch (error) {
    console.error('[quote_artifacts] failed to refresh after draft update', { quoteVersionId: detail.id, error });
  }
  return detail;
}

export async function refreshDraftQuoteVersionFromEstimate(
  quoteVersionId: string,
  estimateVersionId: string,
  actor: string | null,
  mode: QuoteRefreshMode = 'full_rebuild',
): Promise<QuoteVersionDetail> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const estimateUuid = uuidFromAppId(estimateVersionId, 'est');

  const versionRes = await supabaseServer
    .from('quote_versions')
    .select('id, status, quote_id, quotes!inner(project_id)')
    .eq('id', quoteVersionUuid)
    .single();
  if (versionRes.error) {
    if (missingTableError(versionRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(versionRes.error, 'Quote not found'));
  }
  if (!versionRes.data) throw new Error('Quote not found');
  if (String(versionRes.data.status ?? '').toUpperCase() !== 'DRAFT') throw new Error('Quote is locked');

  const currentDetail = await getQuoteVersionDetail(quoteVersionId);
  if (!currentDetail) throw new Error('Quote not found');

  const estimate = await loadEstimate(estimateUuid);
  if (!estimate) throw new Error('Estimate not found');

  const projectUuid = String((versionRes.data as any)?.quotes?.project_id ?? '');
  const estimateLabels = projectUuid ? await loadEstimateLabels(projectUuid) : new Map<string, string>();
  const estimateLabelRaw = estimateLabels.get(estimateUuid) ?? currentDetail.sourceEstimateVersionLabel;
  const estimateLabel = estimateLabelRaw.startsWith('Estimate') ? estimateLabelRaw : `Estimate ${estimateLabelRaw}`;

  const mapping = buildQuoteLineItemsFromEstimate(estimate);
  const generatedDetail: QuoteVersionDetail = {
    ...currentDetail,
    sourceEstimateVersionId: estimateVersionId,
    sourceEstimateVersionLabel: estimateLabel,
    lineItems: mapping.items.map((item, idx) => ({
      id: currentDetail.lineItems[idx]?.id ?? `${currentDetail.id}:line:${idx + 1}`,
      description: item.description,
      qty: item.qty,
      unitPriceIncGstCents: item.unitPriceIncGstCents,
      lineTotalIncGstCents: lineTotalCents(item.qty, item.unitPriceIncGstCents),
      sortOrder: idx,
    })),
    totals: currentDetail.totals,
  };
  const depositPercent = 50;
  const introText = extractEstimateText(estimate, ['introText', 'intro_text']) ?? DEFAULT_QUOTE_INTRO;
  const termsSource = extractEstimateText(estimate, ['termsText', 'terms_text', 'terms']) ?? DEFAULT_QUOTE_TERMS;
  const termsText = applyDepositPercentToTerms(termsSource, depositPercent);
  generatedDetail.depositPercent = depositPercent;
  generatedDetail.introText = introText;
  generatedDetail.termsText = termsText;
  generatedDetail.reference = null;
  generatedDetail.expiresAt = null;

  const preview = buildQuoteRefreshPreview({
    current: currentDetail,
    generated: generatedDetail,
    mode,
  });
  const normalizedLineItems = normalizeDraftLineItems(
    preview.proposedQuote.lineItems.map((item) => ({
      description: item.description,
      qty: item.qty,
      unitPriceIncGstCents: item.unitPriceIncGstCents,
    })),
  );
  const totals = totalsFromNormalizedLineItems(normalizedLineItems);

  const updatePayload: any = {
    source_estimate_version_id: estimateUuid,
    total_inc_gst_cents: totals.totalIncGstCents,
    total_ex_gst_cents: totals.totalExGstCents,
    gst_cents: totals.gstCents,
    pdf_file_id: null,
    render_hash: null,
    preview_base_payload: null,
    preview_rendered_at: null,
  };

  if (mode === 'full_rebuild') {
    updatePayload.reference = null;
    updatePayload.intro_text = introText;
    updatePayload.terms_text = termsText;
    updatePayload.deposit_percent = depositPercent;
    updatePayload.expires_at = null;
  }

  const updateRes = await supabaseServer
    .from('quote_versions')
    .update(updatePayload as any)
    .eq('id', quoteVersionUuid)
    .select('id')
    .single();
  if (updateRes.error || !updateRes.data) {
    if (missingTableError(updateRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(updateRes.error, 'Failed to refresh quote'));
  }

  await replaceQuoteLineItems(quoteVersionUuid, normalizedLineItems);

  if (projectUuid) {
    await insertAuditEvent({
      projectId: projectUuid,
      type: 'quote.refreshed_from_estimate',
      payload: { quoteVersionId: quoteVersionUuid, estimateVersionId: estimateUuid, mode },
    });
  }

  let detail = await getQuoteVersionDetail(appIdFromUuid('qv', quoteVersionUuid));
  if (!detail) throw new Error('Failed to load quote');
  try {
    await refreshQuoteArtifactsAfterMutation(detail.id, actor);
    detail = (await getQuoteVersionDetail(detail.id)) ?? detail;
  } catch (error) {
    console.error('[quote_artifacts] failed to refresh after estimate refresh', { quoteVersionId: detail.id, error });
  }
  return detail;
}

export async function previewDraftQuoteRefreshFromEstimate(
  quoteVersionId: string,
  estimateVersionId: string,
  mode: QuoteRefreshMode = 'full_rebuild',
): Promise<QuoteRefreshPreview> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const estimateUuid = uuidFromAppId(estimateVersionId, 'est');

  const versionRes = await supabaseServer
    .from('quote_versions')
    .select('id, status, quotes!inner(project_id)')
    .eq('id', quoteVersionUuid)
    .single();
  if (versionRes.error) {
    if (missingTableError(versionRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(versionRes.error, 'Quote not found'));
  }
  if (!versionRes.data) throw new Error('Quote not found');
  if (String(versionRes.data.status ?? '').toUpperCase() !== 'DRAFT') throw new Error('Quote is locked');

  const currentDetail = await getQuoteVersionDetail(quoteVersionId);
  if (!currentDetail) throw new Error('Quote not found');

  const estimate = await loadEstimate(estimateUuid);
  if (!estimate) throw new Error('Estimate not found');

  const projectUuid = String((versionRes.data as any)?.quotes?.project_id ?? '');
  const estimateLabels = projectUuid ? await loadEstimateLabels(projectUuid) : new Map<string, string>();
  const estimateLabelRaw = estimateLabels.get(estimateUuid) ?? currentDetail.sourceEstimateVersionLabel;
  const estimateLabel = estimateLabelRaw.startsWith('Estimate') ? estimateLabelRaw : `Estimate ${estimateLabelRaw}`;
  const mapping = buildQuoteLineItemsFromEstimate(estimate);

  const generatedDetail: QuoteVersionDetail = {
    ...currentDetail,
    sourceEstimateVersionId: estimateVersionId,
    sourceEstimateVersionLabel: estimateLabel,
    lineItems: mapping.items.map((item, idx) => ({
      id: currentDetail.lineItems[idx]?.id ?? `${currentDetail.id}:line:${idx + 1}`,
      description: item.description,
      qty: item.qty,
      unitPriceIncGstCents: item.unitPriceIncGstCents,
      lineTotalIncGstCents: lineTotalCents(item.qty, item.unitPriceIncGstCents),
      sortOrder: idx,
    })),
    totals: currentDetail.totals,
    reference: null,
    introText: extractEstimateText(estimate, ['introText', 'intro_text']) ?? DEFAULT_QUOTE_INTRO,
    termsText: applyDepositPercentToTerms(
      extractEstimateText(estimate, ['termsText', 'terms_text', 'terms']) ?? DEFAULT_QUOTE_TERMS,
      50,
    ),
    depositPercent: 50,
    expiresAt: null,
  };

  return buildQuoteRefreshPreview({
    current: currentDetail,
    generated: generatedDetail,
    mode,
  });
}

export async function deleteDraftQuoteVersion(quoteVersionId: string): Promise<void> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const res = await supabaseServer
    .from('quote_versions')
    .select('id, status, quote_id, quotes!inner(project_id)')
    .eq('id', quoteVersionUuid)
    .single();
  if (res.error) {
    if (missingTableError(res.error)) throw schemaMissingError();
    throw new Error(errorMessage(res.error, 'Quote not found'));
  }
  if (!res.data) throw new Error('Quote not found');
  if (String(res.data.status ?? '').toUpperCase() !== 'DRAFT') throw new Error('Only drafts can be deleted');

  const deleteRes = await supabaseServer.from('quote_versions').delete().eq('id', quoteVersionUuid);
  if (deleteRes.error) {
    if (missingTableError(deleteRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(deleteRes.error, 'Failed to delete quote'));
  }

  const projectUuid = String((res.data as any)?.quotes?.project_id ?? '');
  if (projectUuid) {
    await insertAuditEvent({ projectId: projectUuid, type: 'quote.deleted', payload: { quoteVersionId: quoteVersionUuid } });
  }
}

export async function reviseQuoteVersion(quoteVersionId: string, actor: string | null): Promise<QuoteVersionDetail> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const versionRes = await supabaseServer
    .from('quote_versions')
    .select('*')
    .eq('id', quoteVersionUuid)
    .single();
  if (versionRes.error) {
    if (missingTableError(versionRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(versionRes.error, 'Quote not found'));
  }
  if (!versionRes.data) throw new Error('Quote not found');

  if (String(versionRes.data.status ?? '').toUpperCase() === 'DRAFT') {
    throw new Error('Draft quotes cannot be revised; edit the draft instead.');
  }

  const quoteUuid = String(versionRes.data.quote_id ?? '');
  const projectRes = await supabaseServer.from('quotes').select('project_id, quote_ref').eq('id', quoteUuid).single();
  if (projectRes.error) {
    if (missingTableError(projectRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(projectRes.error, 'Quote not found'));
  }
  if (!projectRes.data) throw new Error('Quote not found');

  const nextVersion = await nextVersionNumber(quoteUuid);
  const lineItemsRes = await supabaseServer.from('quote_line_items').select('*').eq('quote_version_id', quoteVersionUuid).order('sort_order', { ascending: true });
  if (lineItemsRes.error) {
    if (missingTableError(lineItemsRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(lineItemsRes.error, 'Failed to load quote items'));
  }

  const items = (Array.isArray(lineItemsRes.data) ? lineItemsRes.data : []).map(mapLineItemRow);
  const totals = totalsFromLineItems(items);
  const inheritedCustomerName =
    typeof versionRes.data.customer_name === 'string' && versionRes.data.customer_name.trim()
      ? versionRes.data.customer_name.trim()
      : null;
  const inheritedDepositPercent = normalizeDepositPercent(versionRes.data.deposit_percent, 50);
  const customerName = inheritedCustomerName || (await loadProjectCustomerName(String(projectRes.data.project_id ?? '')));
  const inheritedTermsText = typeof versionRes.data.terms_text === 'string' ? versionRes.data.terms_text : null;
  const termsText = inheritedTermsText ? applyDepositPercentToTerms(inheritedTermsText, inheritedDepositPercent) : null;

  const insertRes = await supabaseServer
    .from('quote_versions')
    .insert({
      quote_id: quoteUuid,
      version_number: nextVersion,
      status: 'DRAFT',
      source_estimate_version_id: versionRes.data.source_estimate_version_id,
      revised_from_quote_version_id: quoteVersionUuid,
      created_by: actor,
      reference: versionRes.data.reference ?? null,
      customer_name: customerName,
      intro_text: versionRes.data.intro_text ?? null,
      terms_text: termsText,
      deposit_percent: inheritedDepositPercent,
      total_inc_gst_cents: totals.totalIncGstCents,
      total_ex_gst_cents: totals.totalExGstCents,
      gst_cents: totals.gstCents,
    } as any)
    .select('*')
    .single();
  if (insertRes.error || !insertRes.data) {
    if (missingTableError(insertRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(insertRes.error, 'Failed to revise quote'));
  }

  const newQuoteVersionUuid = String(insertRes.data.id ?? '');
  if (items.length) {
    const payload = items.map((item, idx) => ({
      quote_version_id: newQuoteVersionUuid,
      sort_order: idx,
      description: item.description,
      qty: item.qty,
      unit_price_inc_gst_cents: item.unitPriceIncGstCents,
      line_total_inc_gst_cents: item.lineTotalIncGstCents,
    }));
    const insertItems = await supabaseServer.from('quote_line_items').insert(payload as any);
    if (insertItems.error) {
      if (missingTableError(insertItems.error)) throw schemaMissingError();
      throw new Error(errorMessage(insertItems.error, 'Failed to revise line items'));
    }
  }

  const projectUuid = String(projectRes.data.project_id ?? '');
  if (projectUuid) {
    await insertAuditEvent({ projectId: projectUuid, type: 'quote.revised', payload: { quoteVersionId: newQuoteVersionUuid, from: quoteVersionUuid } });
  }

  let detail = await getQuoteVersionDetail(appIdFromUuid('qv', newQuoteVersionUuid));
  if (!detail) throw new Error('Failed to load revised quote');
  try {
    await refreshQuoteArtifactsAfterMutation(detail.id, actor);
    detail = (await getQuoteVersionDetail(detail.id)) ?? detail;
  } catch (error) {
    console.error('[quote_artifacts] failed to refresh after revise', { quoteVersionId: detail.id, error });
  }
  return detail;
}

async function buildQuotePdfArtifact(
  detail: QuoteVersionDetail,
  actor: string | null,
): Promise<{ fileUuid: string; filename: string; bytes: Uint8Array; content: Buffer }> {
  const filename = quotePdfFilename(detail.quoteRef, detail.versionNumber);
  const bytes = await generateQuotePdfBytes(detail);
  const projectUuid = uuidFromAppId(detail.projectId, 'proj');
  const content = Buffer.from(bytes);
  const file = await createFileArtifact({
    projectUuid,
    filename,
    contentType: 'application/pdf',
    content,
    actor,
  });

  return { fileUuid: file.fileUuid, filename, bytes, content };
}

export async function createFileArtifact(params: {
  projectUuid: string;
  filename: string;
  contentType: string;
  content: Buffer;
  actor: string | null;
}): Promise<{ fileUuid: string; filename: string }> {
  const filename = params.filename.trim() || 'attachment.pdf';
  const contentType = params.contentType.trim() || 'application/octet-stream';
  const contentBase64 = params.content.toString('base64');

  const fileRes = await supabaseServer
    .from('file_artifacts')
    .insert({
      project_id: params.projectUuid,
      filename,
      content_type: contentType,
      size_bytes: params.content.length,
      content_base64: contentBase64,
      created_by: params.actor,
    } as any)
    .select('id, filename')
    .single();

  if (fileRes.error || !fileRes.data) {
    if (missingTableError(fileRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(fileRes.error, 'Failed to store file'));
  }

  return {
    fileUuid: String(fileRes.data.id ?? ''),
    filename: String(fileRes.data.filename ?? filename),
  };
}

async function loadFileContent(fileUuid: string): Promise<{ filename: string; content: Buffer } | null> {
  const res = await supabaseServer.from('file_artifacts').select('filename, content_base64').eq('id', fileUuid).single();
  if (res.error) {
    if (missingTableError(res.error)) return null;
    throw new Error(errorMessage(res.error, 'Failed to load PDF'));
  }
  if (!res.data) return null;
  const filename = String(res.data.filename ?? 'quote.pdf');
  const base64 = String(res.data.content_base64 ?? '');
  return { filename, content: Buffer.from(base64, 'base64') };
}

function parsePreviewBasePayload(value: unknown): QuotePreviewBasePayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.quote_number !== 'string' || typeof record.quote_total_inc_gst !== 'string') return null;

  return {
    name: typeof record.name === 'string' ? record.name : 'there',
    quote_number: record.quote_number,
    quote_total_inc_gst: record.quote_total_inc_gst,
    project_address: typeof record.project_address === 'string' ? record.project_address : undefined,
    quote_accept_link: typeof record.quote_accept_link === 'string' ? record.quote_accept_link : 'https://preview.invalid',
    quote_valid_until: typeof record.quote_valid_until === 'string' ? record.quote_valid_until : undefined,
    next_step_text: typeof record.next_step_text === 'string' ? record.next_step_text : 'Use the button above to accept the quote and proceed.',
    logo_url: typeof record.logo_url === 'string' ? record.logo_url : undefined,
    reference_id: typeof record.reference_id === 'string' ? record.reference_id : undefined,
    default_subject:
      typeof record.default_subject === 'string' && record.default_subject.trim()
        ? record.default_subject
        : `Quote ready - ${record.quote_number}`,
  };
}

function buildStoredPreviewBasePayload(detail: QuoteVersionDetail): QuotePreviewBasePayload {
  const expiresAtDate = detail.expiresAt ?? addDays(nowIso(), 30);
  return buildQuotePreviewBasePayload({
    detail,
    quoteAcceptUrl: previewQuoteAcceptLink(detail.id),
    expiresAtLabel: renderExpiresLabel(expiresAtDate),
    logoUrl: quoteLogoUrl(),
  });
}

async function loadQuoteArtifactRow(
  quoteVersionId: string,
): Promise<{ renderHash: string | null; previewBase: QuotePreviewBasePayload | null }> {
  const res = await supabaseServer
    .from('quote_versions')
    .select('render_hash, preview_base_payload')
    .eq('id', uuidFromAppId(quoteVersionId, 'qv'))
    .maybeSingle();
  if (res.error) {
    if (missingTableError(res.error)) throw schemaMissingError();
    throw new Error(errorMessage(res.error, 'Failed to load quote artifacts'));
  }

  const row = res.data as any;
  const renderHash = typeof row?.render_hash === 'string' && row.render_hash.trim() ? row.render_hash.trim() : null;
  return {
    renderHash,
    previewBase: parsePreviewBasePayload(row?.preview_base_payload),
  };
}

async function persistQuoteArtifacts(params: {
  quoteVersionId: string;
  renderHash: string;
  previewBase: QuotePreviewBasePayload;
  pdfFileUuid?: string;
}) {
  const payload: Record<string, unknown> = {
    render_hash: params.renderHash,
    preview_base_payload: params.previewBase,
    preview_rendered_at: nowIso(),
  };
  if (params.pdfFileUuid !== undefined) payload.pdf_file_id = params.pdfFileUuid;

  const updateRes = await supabaseServer
    .from('quote_versions')
    .update(payload as any)
    .eq('id', uuidFromAppId(params.quoteVersionId, 'qv'));
  if (updateRes.error) {
    if (missingTableError(updateRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(updateRes.error, 'Failed to store quote artifacts'));
  }
}

export async function clearQuoteArtifacts(quoteVersionId: string): Promise<void> {
  const updateRes = await supabaseServer
    .from('quote_versions')
    .update({
      pdf_file_id: null,
      render_hash: null,
      preview_base_payload: null,
      preview_rendered_at: null,
    } as any)
    .eq('id', uuidFromAppId(quoteVersionId, 'qv'));
  if (updateRes.error) {
    if (missingTableError(updateRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(updateRes.error, 'Failed to clear quote artifacts'));
  }
}

export async function ensureQuoteArtifacts(
  quoteVersionId: string,
  actor: string | null,
  opts?: { requirePdf?: boolean; allowCached?: boolean },
): Promise<{
  detail: QuoteVersionDetail;
  previewBase: QuotePreviewBasePayload;
  renderHash: string;
  cacheHit: boolean;
  pdf?: { fileUuid: string; filename: string; bytes: Uint8Array; content: Buffer };
}> {
  const detail = await getQuoteVersionDetail(quoteVersionId);
  if (!detail) throw new Error('Quote not found');

  const { renderHash: storedRenderHash, previewBase: storedPreviewBase } = await loadQuoteArtifactRow(quoteVersionId);
  const expectedRenderHash = buildQuoteRenderHash(detail);
  const allowCached = opts?.allowCached !== false;

  if (allowCached && storedRenderHash === expectedRenderHash && storedPreviewBase) {
    if (!opts?.requirePdf) {
      return {
        detail,
        previewBase: storedPreviewBase,
        renderHash: expectedRenderHash,
        cacheHit: true,
      };
    }

    const existingFileId = detail.pdfFileId ? uuidFromAppId(detail.pdfFileId, 'file') : null;
    if (existingFileId) {
      const existing = await loadFileContent(existingFileId);
      if (existing) {
        return {
          detail,
          previewBase: storedPreviewBase,
          renderHash: expectedRenderHash,
          cacheHit: true,
          pdf: {
            fileUuid: existingFileId,
            filename: existing.filename,
            bytes: existing.content,
            content: existing.content,
          },
        };
      }
    }
  }

  const previewBase = buildStoredPreviewBasePayload(detail);
  const pdf = opts?.requirePdf ? await buildQuotePdfArtifact(detail, actor) : undefined;
  await persistQuoteArtifacts({
    quoteVersionId,
    renderHash: expectedRenderHash,
    previewBase,
    ...(pdf ? { pdfFileUuid: pdf.fileUuid } : {}),
  });

  return {
    detail: {
      ...detail,
      renderHash: expectedRenderHash,
      ...(pdf ? { pdfFileId: appIdFromUuid('file', pdf.fileUuid) } : {}),
    },
    previewBase,
    renderHash: expectedRenderHash,
    cacheHit: false,
    ...(pdf ? { pdf } : {}),
  };
}

export async function refreshQuoteArtifactsAfterMutation(quoteVersionId: string, actor: string | null): Promise<void> {
  await ensureQuoteArtifacts(quoteVersionId, actor, { requirePdf: true, allowCached: false });
}

export async function generateQuotePdf(quoteVersionId: string, actor: string | null): Promise<{ fileId: string; filename: string; bytes: Uint8Array }> {
  const ensured = await ensureQuoteArtifacts(quoteVersionId, actor, { requirePdf: true });
  if (!ensured.pdf) throw new Error('Failed to generate quote PDF');
  return {
    fileId: appIdFromUuid('file', ensured.pdf.fileUuid),
    filename: ensured.pdf.filename,
    bytes: ensured.pdf.bytes,
  };
}

export async function ensurePdfForSend(detail: QuoteVersionDetail, actor: string | null): Promise<{ fileUuid: string; filename: string; content: Buffer }> {
  const unpriced = detail.lineItems
    .map((item, idx) => {
      const title = String(item.description ?? '').split('\n')[0]?.trim() || `Line item ${idx + 1}`;
      return { item, title };
    })
    .filter(({ item }) => item.unitPriceIncGstCents === 0 || item.lineTotalIncGstCents === 0);

  if (unpriced.length) {
    const example = unpriced[0]?.title || 'Line item';
    throw new Error(`Quote contains unpriced items (e.g. ${example}). Price or remove before sending.`);
  }

  const ensured = await ensureQuoteArtifacts(detail.id, actor, { requirePdf: true });
  if (!ensured.pdf) throw new Error('Failed to prepare quote PDF');
  return {
    fileUuid: ensured.pdf.fileUuid,
    filename: ensured.pdf.filename,
    content: ensured.pdf.content,
  };
}

export async function insertSendLog(params: {
  projectUuid: string;
  quoteVersionUuid: string;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  attachmentFileIds: string[];
  provider: string | null;
  providerMessageId: string | null;
  acceptTokenHash?: string | null;
  status: 'SENT' | 'FAILED';
  errorMessage?: string | null;
  actor: string | null;
  sentAt?: string | null;
}) {
  const payload: any = {
    project_id: params.projectUuid,
    quote_version_id: params.quoteVersionUuid,
    from_name: params.fromName,
    from_email: params.fromEmail,
    reply_to_email: params.replyTo,
    to_emails: params.to,
    cc_emails: params.cc,
    bcc_emails: params.bcc,
    subject: params.subject,
    body_html: params.bodyHtml,
    body_text: params.bodyText,
    attachment_file_ids: params.attachmentFileIds,
    provider: params.provider,
    provider_message_id: params.providerMessageId,
    accept_token_hash: params.acceptTokenHash ?? null,
    status: params.status,
    error_message: params.errorMessage ?? null,
    created_by: params.actor,
    sent_at: params.sentAt ?? null,
  };

  const res = await supabaseServer.from('quote_send_logs').insert(payload).select('id').single();
  if (res.error) {
    if (missingTableError(res.error)) throw schemaMissingError();
    throw new Error(errorMessage(res.error, 'Failed to log email'));
  }
  return String(res.data?.id ?? '');
}

export async function markQuoteAccepted(quoteVersionId: string, actor: string | null): Promise<QuoteAcceptResult> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const versionRes = await supabaseServer
    .from('quote_versions')
    .select('id, status, quote_id')
    .eq('id', quoteVersionUuid)
    .single();
  if (versionRes.error) {
    if (missingTableError(versionRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(versionRes.error, 'Quote not found'));
  }
  if (!versionRes.data) throw new Error('Quote not found');
  if (String(versionRes.data.status ?? '').toUpperCase() !== 'SENT') throw new Error('Only sent quotes can be accepted');

  const updateRes = await supabaseServer
    .from('quote_versions')
    .update({ status: 'ACCEPTED', accepted_at: new Date().toISOString() } as any)
    .eq('id', quoteVersionUuid);
  if (updateRes.error) {
    if (missingTableError(updateRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(updateRes.error, 'Failed to update quote'));
  }

  const quoteRes = await supabaseServer.from('quotes').select('project_id').eq('id', versionRes.data.quote_id).single();
  if (quoteRes.error) {
    if (missingTableError(quoteRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(quoteRes.error, 'Quote not found'));
  }
  const projectUuid = String(quoteRes.data?.project_id ?? '');
  if (projectUuid) {
    await insertAuditEvent({ projectId: projectUuid, type: 'quote.accepted', payload: { quoteVersionId: quoteVersionUuid } });
  }
  const invoiceResult = await ensureDepositInvoiceForAcceptedQuote({ quoteVersionUuid, actor });

  let updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) throw new Error('Failed to load quote');
  try {
    await refreshQuoteArtifactsAfterMutation(updated.id, actor);
    updated = (await getQuoteVersionDetail(updated.id)) ?? updated;
  } catch (error) {
    console.error('[quote_artifacts] failed to refresh after accept', { quoteVersionId: updated.id, error });
  }
  return {
    quoteVersion: updated,
    invoice: {
      id: appIdFromUuid('inv', invoiceResult.invoice.id),
      invoiceRef: invoiceResult.invoice.invoice_ref,
      sent: invoiceResult.sent,
      sendError: invoiceResult.sendError,
    },
  };
}

export async function markQuoteDeclined(quoteVersionId: string, actor: string | null): Promise<QuoteVersionDetail> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const versionRes = await supabaseServer
    .from('quote_versions')
    .select('id, status, quote_id')
    .eq('id', quoteVersionUuid)
    .single();
  if (versionRes.error) {
    if (missingTableError(versionRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(versionRes.error, 'Quote not found'));
  }
  if (!versionRes.data) throw new Error('Quote not found');
  const currentStatus = String(versionRes.data.status ?? '').toUpperCase();
  if (currentStatus !== 'SENT' && currentStatus !== 'ACCEPTED') throw new Error('Only sent or accepted quotes can be declined');

  const updateRes = await supabaseServer
    .from('quote_versions')
    .update({ status: 'DECLINED' } as any)
    .eq('id', quoteVersionUuid);
  if (updateRes.error) {
    if (missingTableError(updateRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(updateRes.error, 'Failed to update quote'));
  }

  const quoteRes = await supabaseServer.from('quotes').select('project_id').eq('id', versionRes.data.quote_id).single();
  if (quoteRes.error) {
    if (missingTableError(quoteRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(quoteRes.error, 'Quote not found'));
  }
  const projectUuid = String(quoteRes.data?.project_id ?? '');
  if (projectUuid) {
    await insertAuditEvent({ projectId: projectUuid, type: 'quote.declined', payload: { quoteVersionId: quoteVersionUuid } });
  }
  if (currentStatus === 'ACCEPTED') {
    await voidOpenDepositInvoiceForQuote({
      quoteUuid: String(versionRes.data.quote_id ?? ''),
      actor,
      reason: 'quote_declined',
    });
  }

  let updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) throw new Error('Failed to load quote');
  try {
    await refreshQuoteArtifactsAfterMutation(updated.id, actor);
    updated = (await getQuoteVersionDetail(updated.id)) ?? updated;
  } catch (error) {
    console.error('[quote_artifacts] failed to refresh after decline', { quoteVersionId: updated.id, error });
  }
  return updated;
}

export async function downloadQuotePdf(
  quoteVersionId: string,
  actor: string | null,
  opts: { forceRegenerateDraft?: boolean } = {},
): Promise<{ filename: string; bytes: Uint8Array; cacheHit: boolean }> {
  let allowCached = true;
  if (opts.forceRegenerateDraft) {
    const detail = await getQuoteVersionDetail(quoteVersionId);
    if (!detail) throw new Error('Quote not found');
    allowCached = detail.status !== 'DRAFT';
  }

  const ensured = await ensureQuoteArtifacts(quoteVersionId, actor, { requirePdf: true, allowCached });
  if (!ensured.pdf) throw new Error('Failed to load quote PDF');
  return {
    filename: ensured.pdf.filename,
    bytes: ensured.pdf.bytes,
    cacheHit: ensured.cacheHit,
  };
}
