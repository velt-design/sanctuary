import 'server-only';

import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabaseClient';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { buildVersionLabelMap } from '@/lib/estimates/server';
import type { Estimate } from '@/lib/types/estimate';
import type { QuoteLineItem, QuoteSendLog, QuoteStatus, QuoteVersion, QuoteVersionDetail } from './types';
import { DEFAULT_QUOTE_INTRO, DEFAULT_QUOTE_TERMS } from './defaults';
import { buildQuoteLineItemsFromEstimate } from './mapping';
import { lineTotalCents, totalsFromLineItems } from './utils';
import { generateQuotePdfBytes, quotePdfFilename } from './pdf';

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
  const estimateLabelRaw = estimateLabelMap.get(estimateId) ?? 'v—';
  const estimateLabel = estimateLabelRaw.startsWith('Estimate') ? estimateLabelRaw : `Estimate ${estimateLabelRaw}`;

  return {
    id: appIdFromUuid('qv', String(row?.id ?? '')),
    quoteId: appIdFromUuid('qt', String(row?.quote_id ?? row?.quotes?.id ?? '')),
    projectId: projectIdApp,
    quoteRef,
    versionNumber: Number(row?.version_number ?? 0) || 0,
    status: toStatus(row?.status),
    sourceEstimateVersionId: appIdFromUuid('est', estimateId),
    sourceEstimateVersionLabel: estimateLabel,
    revisedFromQuoteVersionId: row?.revised_from_quote_version_id ? appIdFromUuid('qv', String(row.revised_from_quote_version_id)) : null,
    createdAt: typeof row?.created_at === 'string' ? row.created_at : nowIso(),
    createdBy: typeof row?.created_by === 'string' ? row.created_by : null,
    sentAt: typeof row?.sent_at === 'string' ? row.sent_at : null,
    sentBy: typeof row?.sent_by === 'string' ? row.sent_by : null,
    expiresAt: typeof row?.expires_at === 'string' ? row.expires_at : null,
    reference: typeof row?.reference === 'string' ? row.reference : null,
    introText: typeof row?.intro_text === 'string' ? row.intro_text : null,
    termsText: typeof row?.terms_text === 'string' ? row.terms_text : null,
    totals: {
      totalIncGstCents: Number(row?.total_inc_gst_cents ?? 0) || 0,
      totalExGstCents: Number(row?.total_ex_gst_cents ?? 0) || 0,
      gstCents: Number(row?.gst_cents ?? 0) || 0,
    },
    pdfFileId: row?.pdf_file_id ? appIdFromUuid('file', String(row.pdf_file_id)) : null,
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
      .select('id, name, site_address, region, quote_ref, contact_id, contacts ( id, name, email, phone )')
      .eq('id', projectUuid)
      .maybeSingle(),
  ]);

  const version = mapQuoteVersionRow(row, estimateLabels, projectId);

  const lineItems = (Array.isArray(lineItemsRes.data) ? lineItemsRes.data : []).map(mapLineItemRow);
  const sendLogs = (Array.isArray(logsRes.data) ? logsRes.data : []).map(mapSendLogRow);

  const projectRow = projectRes?.data as any;
  const contactRow = Array.isArray(projectRow?.contacts) ? projectRow.contacts[0] : projectRow?.contacts ?? null;

  return {
    ...version,
    lineItems,
    sendLogs,
    contact: {
      name: typeof contactRow?.name === 'string' ? contactRow.name : '',
      email: typeof contactRow?.email === 'string' ? contactRow.email : '',
      phone: typeof contactRow?.phone === 'string' ? contactRow.phone : null,
    },
    project: {
      name: typeof projectRow?.name === 'string' ? projectRow.name : '',
      siteAddress: typeof projectRow?.site_address === 'string' ? projectRow.site_address : null,
      region: typeof projectRow?.region === 'string' ? projectRow.region : null,
      quoteRef: typeof projectRow?.quote_ref === 'string' ? projectRow.quote_ref : null,
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
  const termsText = extractEstimateText(estimate, ['termsText', 'terms_text', 'terms']) ?? DEFAULT_QUOTE_TERMS;

  const insertRes = await supabaseServer
    .from('quote_versions')
    .insert({
      quote_id: quote.id,
      version_number: versionNumber,
      status: 'DRAFT',
      source_estimate_version_id: estimateUuid,
      revised_from_quote_version_id: null,
      created_by: actor,
      intro_text: introText,
      terms_text: termsText,
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

  const detail = await getQuoteVersionDetail(appIdFromUuid('qv', quoteVersionUuid));
  if (!detail) throw new Error('Failed to load quote version');
  return detail;
}

export async function updateDraftQuoteVersion(
  quoteVersionId: string,
  patch: {
    reference?: string | null;
    introText?: string | null;
    termsText?: string | null;
    expiresAt?: string | null;
    lineItems?: Array<{ description: string; qty: number; unitPriceIncGstCents: number }>;
  },
): Promise<QuoteVersionDetail> {
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
  if (String(versionRes.data.status ?? '').toUpperCase() !== 'DRAFT') throw new Error('Quote is locked');

  const lineItems = Array.isArray(patch.lineItems) ? patch.lineItems : [];
  const normalizedLineItems: Omit<QuoteLineItem, 'id'>[] = lineItems.map((item, idx) => {
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

  const totals = totalsFromLineItems(
    normalizedLineItems.map((item) => ({
      id: 'tmp',
      description: item.description,
      qty: item.qty,
      unitPriceIncGstCents: item.unitPriceIncGstCents,
      lineTotalIncGstCents: item.lineTotalIncGstCents,
      sortOrder: item.sortOrder,
    })),
  );

  const updatePayload: any = {
    reference: typeof patch.reference === 'string' ? patch.reference : patch.reference === null ? null : undefined,
    intro_text: typeof patch.introText === 'string' ? patch.introText : patch.introText === null ? null : undefined,
    terms_text: typeof patch.termsText === 'string' ? patch.termsText : patch.termsText === null ? null : undefined,
    expires_at: typeof patch.expiresAt === 'string' ? patch.expiresAt : patch.expiresAt === null ? null : undefined,
    total_inc_gst_cents: totals.totalIncGstCents,
    total_ex_gst_cents: totals.totalExGstCents,
    gst_cents: totals.gstCents,
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

  const deleteRes = await supabaseServer.from('quote_line_items').delete().eq('quote_version_id', quoteVersionUuid);
  if (deleteRes.error) {
    if (missingTableError(deleteRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(deleteRes.error, 'Failed to update line items'));
  }

  if (normalizedLineItems.length) {
    const payload = normalizedLineItems.map((item) => ({
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

  const detail = await getQuoteVersionDetail(appIdFromUuid('qv', quoteVersionUuid));
  if (!detail) throw new Error('Failed to load quote');
  return detail;
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
      intro_text: versionRes.data.intro_text ?? null,
      terms_text: versionRes.data.terms_text ?? null,
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

  const detail = await getQuoteVersionDetail(appIdFromUuid('qv', newQuoteVersionUuid));
  if (!detail) throw new Error('Failed to load revised quote');
  return detail;
}

export async function generateQuotePdf(quoteVersionId: string, actor: string | null): Promise<{ fileId: string; filename: string; bytes: Uint8Array }> {
  const detail = await getQuoteVersionDetail(quoteVersionId);
  if (!detail) throw new Error('Quote not found');

  const filename = quotePdfFilename(detail.quoteRef, detail.versionNumber);
  const bytes = await generateQuotePdfBytes(detail);
  const base64 = Buffer.from(bytes).toString('base64');

  const projectUuid = uuidFromAppId(detail.projectId, 'proj');

  const fileRes = await supabaseServer
    .from('file_artifacts')
    .insert({
      project_id: projectUuid,
      filename,
      content_type: 'application/pdf',
      size_bytes: bytes.length,
      content_base64: base64,
      created_by: actor,
    } as any)
    .select('id')
    .single();

  if (fileRes.error || !fileRes.data) {
    if (missingTableError(fileRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(fileRes.error, 'Failed to store PDF'));
  }

  const fileUuid = String(fileRes.data.id ?? '');

  const updateRes = await supabaseServer
    .from('quote_versions')
    .update({ pdf_file_id: fileUuid } as any)
    .eq('id', uuidFromAppId(quoteVersionId, 'qv'));
  if (updateRes.error) {
    if (missingTableError(updateRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(updateRes.error, 'Failed to store PDF'));
  }

  return { fileId: appIdFromUuid('file', fileUuid), filename, bytes };
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

  const existingFileId = detail.pdfFileId ? uuidFromAppId(detail.pdfFileId, 'file') : null;

  if (existingFileId && detail.status !== 'DRAFT') {
    const existing = await loadFileContent(existingFileId);
    if (existing) return { fileUuid: existingFileId, filename: existing.filename, content: existing.content };
  }

  const generated = await generateQuotePdf(detail.id, actor);
  return { fileUuid: uuidFromAppId(generated.fileId, 'file'), filename: generated.filename, content: Buffer.from(generated.bytes) };
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

async function createInvoiceTask(projectUuid: string, quoteVersionUuid: string) {
  try {
    const idempotencyKey = `quote_invoice:${projectUuid}:${quoteVersionUuid}`;
    await supabaseServer.from('tasks').upsert(
      {
        project_id: projectUuid,
        type: 'CREATE_INVOICE_XERO',
        status: 'OPEN',
        title: 'Create invoice in Xero',
        details: 'Quote accepted; create invoice and send to customer.',
        idempotency_key: idempotencyKey,
      } as any,
      { onConflict: 'idempotency_key' },
    );
  } catch (err: any) {
    if (missingTableError(err)) return;
    console.error('[quote_task] failed to create invoice task', err);
  }
}

export async function markQuoteAccepted(quoteVersionId: string, actor: string | null): Promise<QuoteVersionDetail> {
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
    .update({ status: 'ACCEPTED' } as any)
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
    await updateProjectStage(projectUuid, 'DEPOSIT', quoteVersionUuid);
    await createInvoiceTask(projectUuid, quoteVersionUuid);
    await insertAuditEvent({ projectId: projectUuid, type: 'quote.accepted', payload: { quoteVersionId: quoteVersionUuid } });
  }

  const updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) throw new Error('Failed to load quote');
  return updated;
}

export async function markQuoteDeclined(quoteVersionId: string): Promise<QuoteVersionDetail> {
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
  if (String(versionRes.data.status ?? '').toUpperCase() !== 'SENT') throw new Error('Only sent quotes can be declined');

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

  const updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) throw new Error('Failed to load quote');
  return updated;
}

export async function downloadQuotePdf(quoteVersionId: string, actor: string | null): Promise<{ filename: string; bytes: Uint8Array }> {
  const detail = await getQuoteVersionDetail(quoteVersionId);
  if (!detail) throw new Error('Quote not found');

  const existingFileId = detail.pdfFileId ? uuidFromAppId(detail.pdfFileId, 'file') : null;
  if (existingFileId && detail.status !== 'DRAFT') {
    const existing = await loadFileContent(existingFileId);
    if (existing) return { filename: existing.filename, bytes: existing.content };
  }

  const generated = await generateQuotePdf(quoteVersionId, actor);
  return { filename: generated.filename, bytes: generated.bytes };
}
