import 'server-only';

import { randomUUID } from 'crypto';
import { insertCommercialAuditEvent } from '../commercial/audit';
import { loadQuoteDeliveryReadiness } from '../commercial/quoteDeliveryReadiness';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import { reconcileQuoteOutcomeCadence } from '@/lib/projects/workItems/quoteCadenceReconciliation';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import type { Estimate } from '@/lib/types/estimate';
import type { QuoteAcceptResult, QuoteLineItem, QuoteSendLog, QuoteStatus, QuoteVersion, QuoteVersionDetail } from './types';
import type { QuotePaymentTerm } from './paymentSchedule';
import {
  DEFAULT_QUOTE_INTRO,
  DEFAULT_QUOTE_TERMS,
  normalizeDepositPercent,
} from './defaults';
import { assertQuoteEstimateMappingReady, buildQuoteLineItemsFromEstimate } from './mapping';
import {
  applyPaymentScheduleToTerms,
  buildDefaultQuotePaymentSchedule,
  buildLegacyQuotePaymentSchedule,
  normalizeStoredQuotePaymentSchedule,
  paymentScheduleCompatibilityDepositPercent,
  requireValidQuotePaymentSchedule,
} from './paymentSchedule';
import {
  buildQuotePricingSourceCopyFromEstimate,
  buildQuotePricingSourceCopyFromQuoteVersion,
  buildManualQuotePricingSource,
  protectedQuoteVersionRefreshReason,
  quotePricingSourceAuditPayload,
  quotePricingSourceDbColumns,
  type QuotePricingSourceCopy,
} from './pricingSource';
import { buildQuoteRefreshPreview, type QuoteRefreshMode, type QuoteRefreshPreview } from './refresh';
import { lineTotalCents, totalsFromLineItems } from './utils';
import { generateQuotePdfBytes, quotePdfFilename } from './pdf';
import {
  buildQuotePreviewBasePayload,
  buildQuoteRenderHash,
  parseQuotePreviewBasePayload,
  previewQuoteAcceptLink,
  quoteLogoUrl,
  renderExpiresLabel,
  type QuotePreviewBasePayload,
} from './renderArtifacts';
import { acceptQuoteAndEnsureDepositInvoice } from '../commercial/acceptQuote';
import { mapLineItemRow, mapQuoteVersionRow, mapSendLogRow } from './rowMappers';
import {
  addDays,
  errorMessage,
  firstTrimmedString,
  missingTableError,
  nowIso,
  schemaMissingError,
} from './serverHelpers';
import {
  loadEstimate,
  loadEstimateLabels,
  loadProjectCustomerName,
  loadQuoteFamilyByCommercialScope,
} from './serverLoaders';
import { seedQuoteInternalName } from './internalName.server';
import { resolveManualQuoteCommercialScopeId } from './manualQuoteScope.server';

export async function insertAuditEvent(params: {
  projectId: string;
  type: string;
  payload?: unknown;
  idempotencyKey?: string;
}) {
  return insertCommercialAuditEvent(params);
}

export async function updateProjectStage(projectUuid: string, toStage: string, quoteId?: string | null) {
  const prev = await supabaseServiceRole.from('projects').select('pipeline_stage').eq('id', projectUuid).single();
  const fromStage = typeof prev.data?.pipeline_stage === 'string' ? prev.data.pipeline_stage : null;

  const updateRes = await supabaseServiceRole
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

async function ensureQuote(
  projectUuid: string,
  actor: string | null,
  internalName: string | null,
  commercialScopeId: string | null,
): Promise<{ id: string; quoteRef: string }> {
  const existing = await loadQuoteFamilyByCommercialScope(projectUuid, commercialScopeId);
  if (existing.error) {
    if (missingTableError(existing.error)) throw schemaMissingError();
    throw new Error(errorMessage(existing.error, 'Failed to load quote'));
  }
  if (existing.data?.id) {
    if (!existing.data.internal_name && internalName) {
      await seedQuoteInternalName(String(existing.data.id), internalName);
    }
    return { id: String(existing.data.id), quoteRef: String(existing.data.quote_ref ?? '') };
  }

  const refRes = await supabaseServiceRole.rpc('next_quote_ref');
  if (refRes.error || !refRes.data) {
    if (missingTableError(refRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(refRes.error, 'Failed to allocate quote ref'));
  }
  const quoteRef = String(refRes.data ?? '').trim();
  if (!quoteRef) throw new Error('Failed to allocate quote ref');

  const insertRes = await supabaseServiceRole
    .from('quotes')
    .insert({
      project_id: projectUuid,
      quote_ref: quoteRef,
      created_by: actor,
      internal_name: internalName,
      commercial_scope_id: commercialScopeId,
    } as any)
    .select('id, quote_ref')
    .single();

  if (insertRes.error || !insertRes.data) {
    if (String(insertRes.error?.code ?? '') === '23505') {
      const winner = await loadQuoteFamilyByCommercialScope(projectUuid, commercialScopeId);
      if (!winner.error && winner.data?.id) {
        if (!winner.data.internal_name && internalName) {
          await seedQuoteInternalName(String(winner.data.id), internalName);
        }
        return {
          id: String(winner.data.id),
          quoteRef: String(winner.data.quote_ref ?? ''),
        };
      }
    }
    if (missingTableError(insertRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(insertRes.error, 'Failed to create quote'));
  }

  if (!commercialScopeId) {
    await supabaseServiceRole
      .from('projects')
      .update({ quote_ref: quoteRef } as any)
      .eq('id', projectUuid)
      .is('quote_ref', null);
  }

  return { id: String(insertRes.data.id), quoteRef: String(insertRes.data.quote_ref ?? quoteRef) };
}

function extractEstimateText(estimate: Estimate, keys: string[]): string | null {
  for (const key of keys) {
    const value = (estimate as any)[key] ?? (estimate as any)?.outputs?.[key] ?? (estimate as any)?.inputs?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
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

function quoteLineItemsRpcPayload(items: Omit<QuoteLineItem, 'id'>[]) {
  return items.map((item) => ({
    sort_order: item.sortOrder,
    description: item.description,
    qty: item.qty,
    unit_price_inc_gst_cents: item.unitPriceIncGstCents,
    line_total_inc_gst_cents: item.lineTotalIncGstCents,
  }));
}

function firstRpcRow(value: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : null;
}

function quotePersistenceError(error: any, fallback: string): Error {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = errorMessage(error, fallback);
  if (message.includes('QUOTE_STALE') || code === '40001') {
    return new Error('QUOTE_STALE');
  }
  if (message.includes('Quote is locked') || code === '55000') {
    return new Error('Quote is locked');
  }
  if (missingTableError(error)) return schemaMissingError();
  return new Error(message);
}

async function assertQuoteVersionMutableDraftBoundary(quoteVersionUuid: string, status: unknown): Promise<void> {
  if (protectedQuoteVersionRefreshReason({ status })) throw new Error('Quote is locked');

  const [invoiceRes, jobPackRes] = await Promise.all([
    supabaseServiceRole.from('deposit_invoices').select('id').eq('quote_version_id', quoteVersionUuid).limit(1).maybeSingle(),
    supabaseServiceRole.from('job_pack_generations').select('id').eq('quote_version_id', quoteVersionUuid).limit(1).maybeSingle(),
  ]);

  if (invoiceRes.error && !missingTableError(invoiceRes.error)) {
    throw new Error(errorMessage(invoiceRes.error, 'Failed to verify quote refresh boundary'));
  }
  if (jobPackRes.error && !missingTableError(jobPackRes.error)) {
    throw new Error(errorMessage(jobPackRes.error, 'Failed to verify quote refresh boundary'));
  }

  const reason = protectedQuoteVersionRefreshReason({
    status,
    hasDepositInvoice: Boolean(invoiceRes.data),
    hasJobPackGeneration: Boolean(jobPackRes.data),
  });
  if (reason) throw new Error('Quote is locked');
}

export async function listQuoteVersionsForProject(projectId: string): Promise<QuoteVersion[]> {
  const projectUuid = uuidFromAppId(projectId, 'proj');

  const quotesRes = await supabaseServiceRole
    .from('quotes')
    .select('id, quote_ref, internal_name, commercial_scope_id')
    .eq('project_id', projectUuid);

  if (quotesRes.error) {
    if (missingTableError(quotesRes.error)) return [];
    throw new Error(errorMessage(quotesRes.error, 'Failed to load quotes'));
  }
  const quoteRows = Array.isArray(quotesRes.data) ? quotesRes.data : [];
  const quoteIds = quoteRows.map((row) => String(row.id ?? '')).filter(Boolean);
  if (!quoteIds.length) return [];
  const quoteById = new Map(quoteRows.map((row) => [String(row.id), row]));

  const versionsRes = await supabaseServiceRole
    .from('quote_versions')
    .select('*')
    .in('quote_id', quoteIds)
    .order('version_number', { ascending: false });

  if (versionsRes.error) {
    if (missingTableError(versionsRes.error)) return [];
    throw new Error(errorMessage(versionsRes.error, 'Failed to load quotes'));
  }

  const estimateLabels = await loadEstimateLabels(projectUuid);
  const rows = Array.isArray(versionsRes.data) ? versionsRes.data : [];
  return rows.map((row) => {
    const quote = quoteById.get(String(row.quote_id ?? ''));
    return mapQuoteVersionRow({ ...row, quotes: quote }, estimateLabels, projectId);
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getQuoteVersionDetail(quoteVersionId: string): Promise<QuoteVersionDetail | null> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');

  const versionRes = await supabaseServiceRole
    .from('quote_versions')
    .select('*, quotes!inner(id, project_id, quote_ref, internal_name, commercial_scope_id)')
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

  const [
    estimateLabels,
    lineItemsRes,
    logsRes,
    projectRes,
    deliveryReadiness,
  ] = await Promise.all([
    loadEstimateLabels(projectUuid),
    supabaseServiceRole.from('quote_line_items').select('*').eq('quote_version_id', quoteVersionUuid).order('sort_order', { ascending: true }),
    supabaseServiceRole.from('quote_send_logs').select('*').eq('quote_version_id', quoteVersionUuid).order('created_at', { ascending: false }),
    supabaseServiceRole
      .from('projects')
      .select('*, contacts ( id, name, email, phone, address )')
      .eq('id', projectUuid)
      .maybeSingle(),
    loadQuoteDeliveryReadiness(quoteVersionUuid),
  ]);

  const version = mapQuoteVersionRow(row, estimateLabels, projectId);

  const lineItems = (Array.isArray(lineItemsRes.data) ? lineItemsRes.data : []).map(mapLineItemRow);
  const sendLogs = (Array.isArray(logsRes.data) ? logsRes.data : []).map(mapSendLogRow);

  let projectRow = projectRes?.data as any;
  let contactRow = Array.isArray(projectRow?.contacts) ? projectRow.contacts[0] : projectRow?.contacts ?? null;

  // Keep quote rendering resilient to schema drift in the optional relation select above.
  if (!projectRow && projectRes?.error) {
    const fallbackProjectRes = await supabaseServiceRole.from('projects').select('*').eq('id', projectUuid).maybeSingle();
    if (fallbackProjectRes.data) {
      projectRow = fallbackProjectRes.data as any;
      const contactId = firstTrimmedString(projectRow?.contact_id, projectRow?.contactId);
      if (contactId) {
        const fallbackContactRes = await supabaseServiceRole.from('contacts').select('*').eq('id', contactId).maybeSingle();
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
    commercialWorkflowReady: deliveryReadiness.commercialWorkflowReady,
    unfinishedDelivery: deliveryReadiness.unfinishedDelivery,
  };
}

export async function createQuoteFromEstimate(
  projectId: string,
  estimateVersionId: string,
  actor: string | null,
  clientIntentId = randomUUID(),
  internalName: string | null = null,
): Promise<QuoteVersionDetail> {
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const estimateUuid = uuidFromAppId(estimateVersionId, 'est');

  const estimate = await loadEstimate(estimateUuid);
  if (!estimate) throw new Error('Estimate not found');
  if (estimate.projectId !== projectId) throw new Error('Estimate does not belong to this project');

  const quote = await ensureQuote(projectUuid, actor, internalName, estimate.commercialScopeId);

  const mapping = buildQuoteLineItemsFromEstimate(estimate);
  assertQuoteEstimateMappingReady(mapping);
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
  const paymentTerms = buildDefaultQuotePaymentSchedule({
    quoteTotalIncGstCents: totals.totalIncGstCents,
    approvalRequirement: mapping.approvalRequirement,
    approvalIncGstCents: mapping.approvalIncGstCents,
  });
  const depositPercent = paymentScheduleCompatibilityDepositPercent(paymentTerms, totals.totalIncGstCents);
  const termsSource = extractEstimateText(estimate, ['termsText', 'terms_text', 'terms']) ?? DEFAULT_QUOTE_TERMS;
  const termsText = applyPaymentScheduleToTerms(termsSource, paymentTerms);
  const customerName = await loadProjectCustomerName(projectUuid);
  const pricingSourceCopy = buildQuotePricingSourceCopyFromEstimate({
    estimate,
    sourceEstimateVersionId: estimateUuid,
    copiedAt: nowIso(),
    copiedBy: actor,
    copyReason: 'quote_created',
  });

  const pricingColumns = quotePricingSourceDbColumns(pricingSourceCopy);
  const createRes = await supabaseServiceRole.rpc('commercial_quote_create_draft', {
    p_quote_id: quote.id,
    p_source_estimate_version_id: estimateUuid,
    p_revised_from_quote_version_id: null,
    p_client_intent_id: clientIntentId,
    p_actor: actor,
    p_customer_name: customerName,
    p_reference: null,
    p_intro_text: introText,
    p_terms_text: termsText,
    p_deposit_percent: depositPercent,
    p_payment_terms: paymentTerms,
    p_expires_at: null,
    p_total_inc_gst_cents: totals.totalIncGstCents,
    p_total_ex_gst_cents: totals.totalExGstCents,
    p_gst_cents: totals.gstCents,
    p_pricing_source: pricingColumns.pricing_source,
    p_pricing_source_metadata: pricingColumns.pricing_source_metadata,
    p_line_items: quoteLineItemsRpcPayload(items),
  });
  if (createRes.error) {
    throw quotePersistenceError(createRes.error, 'Failed to create quote version');
  }
  const createdRow = firstRpcRow(createRes.data);
  const quoteVersionUuid =
    typeof createdRow?.id === 'string' ? createdRow.id : '';
  if (!quoteVersionUuid) {
    throw new Error('Failed to create quote version');
  }

  await updateProjectStage(projectUuid, 'QUOTING', quoteVersionUuid);
  await insertAuditEvent({
    projectId: projectUuid,
    type: 'quote.created',
    payload: {
      quoteVersionId: quoteVersionUuid,
      estimateVersionId: estimateUuid,
      copiedBy: actor,
      copyReason: 'quote_created',
      ...quotePricingSourceAuditPayload(pricingSourceCopy),
    },
  });

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

export async function createManualQuote(
  projectId: string,
  actor: string | null,
  clientIntentId: string,
  internalName: string | null,
  lineItems: Array<{ description: string; qty: number; unitPriceIncGstCents: number }>,
): Promise<QuoteVersionDetail> {
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const normalizedItems = normalizeDraftLineItems(lineItems);
  if (!normalizedItems.length) throw new Error('Add at least one quote item.');
  if (normalizedItems.some((item) => !item.description.trim() || item.qty <= 0 || item.unitPriceIncGstCents <= 0)) {
    throw new Error('Each quote item needs a description, quantity, and price greater than $0.');
  }
  const projectRes = await supabaseServiceRole.from('projects').select('id').eq('id', projectUuid).maybeSingle();
  if (projectRes.error || !projectRes.data) throw new Error('Project not found');

  // Before the base contract is accepted, a manual quote may establish or revise
  // that family. Afterwards, a newly created manual scope is independent add-on
  // work; joining it to the base family would replace accepted job value.
  const commercialScopeId = await resolveManualQuoteCommercialScopeId(projectUuid, clientIntentId);
  const quote = await ensureQuote(projectUuid, actor, internalName, commercialScopeId);
  const totals = totalsFromNormalizedLineItems(normalizedItems);
  const paymentTerms = buildDefaultQuotePaymentSchedule({ quoteTotalIncGstCents: totals.totalIncGstCents });
  const depositPercent = paymentScheduleCompatibilityDepositPercent(paymentTerms, totals.totalIncGstCents);
  const pricingSourceCopy = buildManualQuotePricingSource({ copiedAt: nowIso(), copiedBy: actor });
  const pricingColumns = quotePricingSourceDbColumns(pricingSourceCopy);
  const termsText = applyPaymentScheduleToTerms(DEFAULT_QUOTE_TERMS, paymentTerms);
  const createRes = await supabaseServiceRole.rpc('commercial_quote_create_draft', {
    p_quote_id: quote.id,
    p_source_estimate_version_id: null,
    p_revised_from_quote_version_id: null,
    p_client_intent_id: clientIntentId,
    p_actor: actor,
    p_customer_name: await loadProjectCustomerName(projectUuid),
    p_reference: null,
    p_intro_text: DEFAULT_QUOTE_INTRO,
    p_terms_text: termsText,
    p_deposit_percent: depositPercent,
    p_payment_terms: paymentTerms,
    p_expires_at: null,
    p_total_inc_gst_cents: totals.totalIncGstCents,
    p_total_ex_gst_cents: totals.totalExGstCents,
    p_gst_cents: totals.gstCents,
    p_pricing_source: pricingColumns.pricing_source,
    p_pricing_source_metadata: pricingColumns.pricing_source_metadata,
    p_line_items: quoteLineItemsRpcPayload(normalizedItems),
  });
  if (createRes.error) throw quotePersistenceError(createRes.error, 'Failed to create manual quote');
  const createdRow = firstRpcRow(createRes.data);
  const quoteVersionUuid = typeof createdRow?.id === 'string' ? createdRow.id : '';
  if (!quoteVersionUuid) throw new Error('Failed to create manual quote');

  await updateProjectStage(projectUuid, 'QUOTING', quoteVersionUuid);
  await insertAuditEvent({
    projectId: projectUuid,
    type: 'quote.created',
    payload: {
      quoteVersionId: quoteVersionUuid,
      estimateVersionId: null,
      copiedBy: actor,
      copyReason: 'manual_quote_created',
      commercialScopeId,
      commercialScopeKind: commercialScopeId ? 'add_on' : 'base',
      ...quotePricingSourceAuditPayload(pricingSourceCopy),
    },
  });
  let detail = await getQuoteVersionDetail(appIdFromUuid('qv', quoteVersionUuid));
  if (!detail) throw new Error('Failed to load manual quote');
  try {
    await refreshQuoteArtifactsAfterMutation(detail.id, actor);
    detail = (await getQuoteVersionDetail(detail.id)) ?? detail;
  } catch (error) {
    console.error('[quote_artifacts] failed to refresh after manual create', { quoteVersionId: detail.id, error });
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
    paymentTerms?: QuotePaymentTerm[];
    expiresAt?: string | null;
    lineItems?: Array<{ description: string; qty: number; unitPriceIncGstCents: number }>;
    expectedCommercialRevision: number;
  },
): Promise<QuoteVersionDetail> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');

  const versionRes = await supabaseServiceRole
    .from('quote_versions')
    .select('*')
    .eq('id', quoteVersionUuid)
    .single();
  if (versionRes.error) {
    if (missingTableError(versionRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(versionRes.error, 'Quote not found'));
  }
  if (!versionRes.data) throw new Error('Quote not found');
  await assertQuoteVersionMutableDraftBoundary(quoteVersionUuid, versionRes.data.status);

  const currentDetail = await getQuoteVersionDetail(quoteVersionId);
  if (!currentDetail) throw new Error('Quote not found');
  if (!currentDetail.isCurrentDraft) throw new Error('Quote is locked');

  const lineItems = Array.isArray(patch.lineItems)
    ? patch.lineItems
    : currentDetail.lineItems.map((item) => ({
        description: item.description,
        qty: item.qty,
        unitPriceIncGstCents: item.unitPriceIncGstCents,
      }));
  const normalizedLineItems = normalizeDraftLineItems(lineItems);
  const totals = totalsFromNormalizedLineItems(normalizedLineItems);

  const existingDepositPercent = normalizeDepositPercent((versionRes.data as any)?.deposit_percent, 50);
  const existingPaymentTerms = normalizeStoredQuotePaymentSchedule(
    (versionRes.data as any)?.payment_terms,
    currentDetail.totals.totalIncGstCents,
    existingDepositPercent,
  );
  const requestedPaymentTerms = Array.isArray(patch.paymentTerms)
    ? patch.paymentTerms
    : patch.depositPercent !== undefined
      ? buildLegacyQuotePaymentSchedule(totals.totalIncGstCents, patch.depositPercent)
      : existingPaymentTerms;
  const nextPaymentTerms = requireValidQuotePaymentSchedule(requestedPaymentTerms, totals.totalIncGstCents);
  const nextDepositPercent = paymentScheduleCompatibilityDepositPercent(nextPaymentTerms, totals.totalIncGstCents);

  const existingTermsText = typeof (versionRes.data as any)?.terms_text === 'string'
    ? String((versionRes.data as any).terms_text)
    : null;
  const nextTermsText = patch.termsText === null
    ? null
    : applyPaymentScheduleToTerms(
        typeof patch.termsText === 'string'
          ? patch.termsText
          : existingTermsText ?? DEFAULT_QUOTE_TERMS,
        nextPaymentTerms,
      );

  const currentRow = versionRes.data as any;
  const updateRes = await supabaseServiceRole.rpc(
    'commercial_quote_update_draft',
    {
      p_quote_version_id: quoteVersionUuid,
      p_expected_commercial_revision: patch.expectedCommercialRevision,
      p_reference:
        typeof patch.reference === 'string' || patch.reference === null
          ? patch.reference
          : currentDetail.reference ?? null,
      p_intro_text:
        typeof patch.introText === 'string' || patch.introText === null
          ? patch.introText
          : currentDetail.introText ?? null,
      p_terms_text:
        nextTermsText === undefined
          ? currentDetail.termsText ?? null
          : nextTermsText,
      p_deposit_percent: nextDepositPercent,
      p_payment_terms: nextPaymentTerms,
      p_expires_at:
        typeof patch.expiresAt === 'string' || patch.expiresAt === null
          ? patch.expiresAt
          : currentDetail.expiresAt ?? null,
      p_source_estimate_version_id: currentRow.source_estimate_version_id,
      p_total_inc_gst_cents: totals.totalIncGstCents,
      p_total_ex_gst_cents: totals.totalExGstCents,
      p_gst_cents: totals.gstCents,
      p_pricing_source: currentRow.pricing_source ?? 'calculator_live',
      p_pricing_source_metadata: currentRow.pricing_source_metadata ?? {},
      p_line_items: quoteLineItemsRpcPayload(normalizedLineItems),
    },
  );
  if (updateRes.error) {
    throw quotePersistenceError(updateRes.error, 'Failed to update quote');
  }

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

  const versionRes = await supabaseServiceRole
    .from('quote_versions')
    .select('id, status, is_current_draft, quote_id, pricing_source, quotes!inner(project_id)')
    .eq('id', quoteVersionUuid)
    .single();
  if (versionRes.error) {
    if (missingTableError(versionRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(versionRes.error, 'Quote not found'));
  }
  if (!versionRes.data) throw new Error('Quote not found');
  await assertQuoteVersionMutableDraftBoundary(quoteVersionUuid, versionRes.data.status);
  if (String(versionRes.data.pricing_source ?? '') === 'manual') {
    throw new Error('Manual quotes cannot be refreshed from an estimate.');
  }

  const currentDetail = await getQuoteVersionDetail(quoteVersionId);
  if (!currentDetail) throw new Error('Quote not found');
  if (!currentDetail.isCurrentDraft) throw new Error('Quote is locked');

  const estimate = await loadEstimate(estimateUuid);
  if (!estimate) throw new Error('Estimate not found');

  const projectUuid = String((versionRes.data as any)?.quotes?.project_id ?? '');
  const estimateLabels = projectUuid ? await loadEstimateLabels(projectUuid) : new Map<string, string>();
  const estimateLabelRaw = estimateLabels.get(estimateUuid) ?? currentDetail.sourceEstimateVersionLabel;
  const estimateLabel = estimateLabelRaw.startsWith('Estimate') ? estimateLabelRaw : `Estimate ${estimateLabelRaw}`;

  const mapping = buildQuoteLineItemsFromEstimate(estimate);
  assertQuoteEstimateMappingReady(mapping);
  const generatedItems = mapping.items.map((item, idx) => ({
    id: currentDetail.lineItems[idx]?.id ?? `${currentDetail.id}:line:${idx + 1}`,
    description: item.description,
    qty: item.qty,
    unitPriceIncGstCents: item.unitPriceIncGstCents,
    lineTotalIncGstCents: lineTotalCents(item.qty, item.unitPriceIncGstCents),
    sortOrder: idx,
  }));
  const generatedTotals = totalsFromLineItems(generatedItems);
  const generatedPaymentTerms = buildDefaultQuotePaymentSchedule({
    quoteTotalIncGstCents: generatedTotals.totalIncGstCents,
    approvalRequirement: mapping.approvalRequirement,
    approvalIncGstCents: mapping.approvalIncGstCents,
  });
  const generatedDepositPercent = paymentScheduleCompatibilityDepositPercent(
    generatedPaymentTerms,
    generatedTotals.totalIncGstCents,
  );
  const generatedDetail: QuoteVersionDetail = {
    ...currentDetail,
    sourceEstimateVersionId: estimateVersionId,
    sourceEstimateVersionLabel: estimateLabel,
    lineItems: generatedItems,
    totals: generatedTotals,
    paymentTerms: generatedPaymentTerms,
  };
  const introText = extractEstimateText(estimate, ['introText', 'intro_text']) ?? DEFAULT_QUOTE_INTRO;
  const termsSource = extractEstimateText(estimate, ['termsText', 'terms_text', 'terms']) ?? DEFAULT_QUOTE_TERMS;
  const termsText = applyPaymentScheduleToTerms(termsSource, generatedPaymentTerms);
  generatedDetail.depositPercent = generatedDepositPercent;
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
  const pricingSourceCopy = buildQuotePricingSourceCopyFromEstimate({
    estimate,
    sourceEstimateVersionId: estimateUuid,
    copiedAt: nowIso(),
    copiedBy: actor,
    copyReason: 'quote_refreshed_from_estimate',
  });
  const pricingColumns = quotePricingSourceDbColumns(pricingSourceCopy);
  const proposed = preview.proposedQuote;
  const proposedPaymentTerms = requireValidQuotePaymentSchedule(
    proposed.paymentTerms ?? buildLegacyQuotePaymentSchedule(totals.totalIncGstCents, proposed.depositPercent),
    totals.totalIncGstCents,
  );
  const proposedDepositPercent = paymentScheduleCompatibilityDepositPercent(proposedPaymentTerms, totals.totalIncGstCents);
  const updateRes = await supabaseServiceRole.rpc(
    'commercial_quote_update_draft',
    {
      p_quote_version_id: quoteVersionUuid,
      p_expected_commercial_revision: currentDetail.commercialRevision,
      p_reference: proposed.reference ?? null,
      p_intro_text: proposed.introText ?? null,
      p_terms_text: applyPaymentScheduleToTerms(proposed.termsText, proposedPaymentTerms),
      p_deposit_percent: proposedDepositPercent,
      p_payment_terms: proposedPaymentTerms,
      p_expires_at: proposed.expiresAt ?? null,
      p_source_estimate_version_id: estimateUuid,
      p_total_inc_gst_cents: totals.totalIncGstCents,
      p_total_ex_gst_cents: totals.totalExGstCents,
      p_gst_cents: totals.gstCents,
      p_pricing_source: pricingColumns.pricing_source,
      p_pricing_source_metadata: pricingColumns.pricing_source_metadata,
      p_line_items: quoteLineItemsRpcPayload(normalizedLineItems),
    },
  );
  if (updateRes.error) {
    throw quotePersistenceError(updateRes.error, 'Failed to refresh quote');
  }

  if (projectUuid) {
    await insertAuditEvent({
      projectId: projectUuid,
      type: 'quote.refreshed_from_estimate',
      payload: {
        quoteVersionId: quoteVersionUuid,
        estimateVersionId: estimateUuid,
        mode,
        copiedBy: actor,
        copyReason: 'quote_refreshed_from_estimate',
        ...quotePricingSourceAuditPayload(pricingSourceCopy),
      },
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

  const versionRes = await supabaseServiceRole
    .from('quote_versions')
    .select('id, status, pricing_source, quotes!inner(project_id)')
    .eq('id', quoteVersionUuid)
    .single();
  if (versionRes.error) {
    if (missingTableError(versionRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(versionRes.error, 'Quote not found'));
  }
  if (!versionRes.data) throw new Error('Quote not found');
  if (String(versionRes.data.status ?? '').toUpperCase() !== 'DRAFT') throw new Error('Quote is locked');
  if (String(versionRes.data.pricing_source ?? '') === 'manual') {
    throw new Error('Manual quotes cannot be refreshed from an estimate.');
  }

  const currentDetail = await getQuoteVersionDetail(quoteVersionId);
  if (!currentDetail) throw new Error('Quote not found');

  const estimate = await loadEstimate(estimateUuid);
  if (!estimate) throw new Error('Estimate not found');

  const projectUuid = String((versionRes.data as any)?.quotes?.project_id ?? '');
  const estimateLabels = projectUuid ? await loadEstimateLabels(projectUuid) : new Map<string, string>();
  const estimateLabelRaw = estimateLabels.get(estimateUuid) ?? currentDetail.sourceEstimateVersionLabel;
  const estimateLabel = estimateLabelRaw.startsWith('Estimate') ? estimateLabelRaw : `Estimate ${estimateLabelRaw}`;
  const mapping = buildQuoteLineItemsFromEstimate(estimate);
  assertQuoteEstimateMappingReady(mapping);

  const generatedItems = mapping.items.map((item, idx) => ({
    id: currentDetail.lineItems[idx]?.id ?? `${currentDetail.id}:line:${idx + 1}`,
    description: item.description,
    qty: item.qty,
    unitPriceIncGstCents: item.unitPriceIncGstCents,
    lineTotalIncGstCents: lineTotalCents(item.qty, item.unitPriceIncGstCents),
    sortOrder: idx,
  }));
  const generatedTotals = totalsFromLineItems(generatedItems);
  const generatedPaymentTerms = buildDefaultQuotePaymentSchedule({
    quoteTotalIncGstCents: generatedTotals.totalIncGstCents,
    approvalRequirement: mapping.approvalRequirement,
    approvalIncGstCents: mapping.approvalIncGstCents,
  });
  const generatedDetail: QuoteVersionDetail = {
    ...currentDetail,
    sourceEstimateVersionId: estimateVersionId,
    sourceEstimateVersionLabel: estimateLabel,
    lineItems: generatedItems,
    totals: generatedTotals,
    reference: null,
    introText: extractEstimateText(estimate, ['introText', 'intro_text']) ?? DEFAULT_QUOTE_INTRO,
    termsText: applyPaymentScheduleToTerms(
      extractEstimateText(estimate, ['termsText', 'terms_text', 'terms']) ?? DEFAULT_QUOTE_TERMS,
      generatedPaymentTerms,
    ),
    depositPercent: paymentScheduleCompatibilityDepositPercent(generatedPaymentTerms, generatedTotals.totalIncGstCents),
    paymentTerms: generatedPaymentTerms,
    expiresAt: null,
  };

  return buildQuoteRefreshPreview({
    current: currentDetail,
    generated: generatedDetail,
    mode,
  });
}

export async function deleteDraftQuoteVersion(quoteVersionId: string, actor: string | null = null): Promise<void> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const res = await supabaseServiceRole
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
  if ((res.data as any).is_current_draft === false) {
    throw new Error('Quote is locked');
  }

  const deleteRes = await supabaseServiceRole.from('quote_versions').delete().eq('id', quoteVersionUuid);
  if (deleteRes.error) {
    if (missingTableError(deleteRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(deleteRes.error, 'Failed to delete quote'));
  }

  const projectUuid = String((res.data as any)?.quotes?.project_id ?? '');
  if (projectUuid) {
    await insertAuditEvent({ projectId: projectUuid, type: 'quote.deleted', payload: { quoteVersionId: quoteVersionUuid, actor } });
  }
}

export async function reviseQuoteVersion(
  quoteVersionId: string,
  actor: string | null,
  clientIntentId = randomUUID(),
): Promise<QuoteVersionDetail> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const versionRes = await supabaseServiceRole
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
  const projectRes = await supabaseServiceRole.from('quotes').select('project_id, quote_ref').eq('id', quoteUuid).single();
  if (projectRes.error) {
    if (missingTableError(projectRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(projectRes.error, 'Quote not found'));
  }
  if (!projectRes.data) throw new Error('Quote not found');

  const lineItemsRes = await supabaseServiceRole.from('quote_line_items').select('*').eq('quote_version_id', quoteVersionUuid).order('sort_order', { ascending: true });
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
  const inheritedPaymentTerms = normalizeStoredQuotePaymentSchedule(
    versionRes.data.payment_terms,
    totals.totalIncGstCents,
    inheritedDepositPercent,
  );
  const inheritedCompatibilityPercent = paymentScheduleCompatibilityDepositPercent(
    inheritedPaymentTerms,
    totals.totalIncGstCents,
  );
  const customerName = inheritedCustomerName || (await loadProjectCustomerName(String(projectRes.data.project_id ?? '')));
  const inheritedTermsText = typeof versionRes.data.terms_text === 'string' ? versionRes.data.terms_text : null;
  const termsText = inheritedTermsText ? applyPaymentScheduleToTerms(inheritedTermsText, inheritedPaymentTerms) : null;
  const sourceEstimateUuid = String(versionRes.data.source_estimate_version_id ?? '');
  const copiedAt = nowIso();
  let pricingSourceCopy: QuotePricingSourceCopy | null = buildQuotePricingSourceCopyFromQuoteVersion({
    quoteVersion: versionRes.data as any,
    copiedAt,
    copiedBy: actor,
    copyReason: 'quote_revised',
    revisedFromQuoteVersionId: quoteVersionUuid,
  });
  if (!pricingSourceCopy && sourceEstimateUuid) {
    const sourceEstimate = await loadEstimate(sourceEstimateUuid);
    if (sourceEstimate) {
      pricingSourceCopy = buildQuotePricingSourceCopyFromEstimate({
        estimate: sourceEstimate,
        sourceEstimateVersionId: sourceEstimateUuid,
        copiedAt,
        copiedBy: actor,
        copyReason: 'quote_revised',
      });
    }
  }

  const pricingColumns = pricingSourceCopy
    ? quotePricingSourceDbColumns(pricingSourceCopy)
    : {
        pricing_source:
          String(versionRes.data.pricing_source ?? '') === 'manual'
            ? 'manual'
            : String(versionRes.data.pricing_source ?? '') === 'workbench_solved'
              ? 'workbench_solved'
              : 'calculator_live',
        pricing_source_metadata:
          versionRes.data.pricing_source_metadata &&
          typeof versionRes.data.pricing_source_metadata === 'object'
            ? versionRes.data.pricing_source_metadata
            : {},
      };
  const normalizedItems = normalizeDraftLineItems(
    items.map((item) => ({
      description: item.description,
      qty: item.qty,
      unitPriceIncGstCents: item.unitPriceIncGstCents,
    })),
  );
  const insertRes = await supabaseServiceRole.rpc(
    'commercial_quote_create_draft',
    {
      p_quote_id: quoteUuid,
      p_source_estimate_version_id: versionRes.data.source_estimate_version_id,
      p_revised_from_quote_version_id: quoteVersionUuid,
      p_client_intent_id: clientIntentId,
      p_actor: actor,
      p_customer_name: customerName,
      p_reference: versionRes.data.reference ?? null,
      p_intro_text: versionRes.data.intro_text ?? null,
      p_terms_text: termsText,
      p_deposit_percent: inheritedCompatibilityPercent,
      p_payment_terms: inheritedPaymentTerms,
      p_expires_at: null,
      p_total_inc_gst_cents: totals.totalIncGstCents,
      p_total_ex_gst_cents: totals.totalExGstCents,
      p_gst_cents: totals.gstCents,
      p_pricing_source: pricingColumns.pricing_source,
      p_pricing_source_metadata: pricingColumns.pricing_source_metadata,
      p_line_items: quoteLineItemsRpcPayload(normalizedItems),
    },
  );
  if (insertRes.error) {
    throw quotePersistenceError(insertRes.error, 'Failed to revise quote');
  }
  const insertedRow = firstRpcRow(insertRes.data);
  const newQuoteVersionUuid =
    typeof insertedRow?.id === 'string' ? insertedRow.id : '';
  if (!newQuoteVersionUuid) throw new Error('Failed to revise quote');

  const projectUuid = String(projectRes.data.project_id ?? '');
  if (projectUuid) {
    await reconcileQuoteOutcomeCadence({
      serviceClient: supabaseServiceRole,
      projectId: projectUuid,
      quoteVersionId: quoteVersionUuid,
      supersedingQuoteVersionId: newQuoteVersionUuid,
      outcome: 'SUPERSEDED',
    });
    await insertAuditEvent({
      projectId: projectUuid,
      type: 'quote.revised',
      payload: {
        quoteVersionId: newQuoteVersionUuid,
        from: quoteVersionUuid,
        estimateVersionId: sourceEstimateUuid || null,
        copiedBy: actor,
        copyReason: 'quote_revised',
        ...(pricingSourceCopy ? quotePricingSourceAuditPayload(pricingSourceCopy) : {}),
      },
    });
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

  const fileRes = await supabaseServiceRole
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
  const res = await supabaseServiceRole.from('file_artifacts').select('filename, content_base64').eq('id', fileUuid).single();
  if (res.error) {
    if (missingTableError(res.error)) return null;
    throw new Error(errorMessage(res.error, 'Failed to load PDF'));
  }
  if (!res.data) return null;
  const filename = String(res.data.filename ?? 'quote.pdf');
  const base64 = String(res.data.content_base64 ?? '');
  return { filename, content: Buffer.from(base64, 'base64') };
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
  const res = await supabaseServiceRole
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
    previewBase: parseQuotePreviewBasePayload(row?.preview_base_payload),
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

  const updateRes = await supabaseServiceRole
    .from('quote_versions')
    .update(payload as any)
    .eq('id', uuidFromAppId(params.quoteVersionId, 'qv'));
  if (updateRes.error) {
    if (missingTableError(updateRes.error)) throw schemaMissingError();
    throw new Error(errorMessage(updateRes.error, 'Failed to store quote artifacts'));
  }
}

async function clearQuoteArtifacts(quoteVersionId: string): Promise<void> {
  const updateRes = await supabaseServiceRole
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

async function refreshQuoteArtifactsAfterMutation(quoteVersionId: string, actor: string | null): Promise<void> {
  await ensureQuoteArtifacts(quoteVersionId, actor, { requirePdf: true, allowCached: false });
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
  deliveryIntentId?: string | null;
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
    delivery_intent_id: params.deliveryIntentId ?? null,
    created_by: params.actor,
    sent_at: params.sentAt ?? null,
  };

  const res = await supabaseServiceRole.from('quote_send_logs').insert(payload).select('id').single();
  if (res.error) {
    if (
      params.deliveryIntentId &&
      String((res.error as { code?: unknown }).code ?? '') === '23505'
    ) {
      const existing = await supabaseServiceRole
        .from('quote_send_logs')
        .select('id')
        .eq('delivery_intent_id', params.deliveryIntentId)
        .maybeSingle();
      if (!existing.error && existing.data?.id) return String(existing.data.id);
    }
    if (missingTableError(res.error)) throw schemaMissingError();
    throw new Error(errorMessage(res.error, 'Failed to log email'));
  }
  return String(res.data?.id ?? '');
}

export async function markQuoteAccepted(quoteVersionId: string, actor: string | null): Promise<QuoteAcceptResult> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const before = await getQuoteVersionDetail(quoteVersionId);
  if (!before) throw new Error('Quote not found');

  const accepted = await acceptQuoteAndEnsureDepositInvoice({
    quoteVersionUuid,
    actor,
  });

  let updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) {
    // The acceptance command has already committed. Preserve that confirmed
    // truth in the response even if a follow-up read is temporarily unavailable.
    console.error('[quote_acceptance] committed quote could not be reloaded', {
      quoteVersionId,
    });
    updated = {
      ...before,
      status: 'ACCEPTED',
      isCurrentDraft: false,
    };
  } else {
    try {
      await refreshQuoteArtifactsAfterMutation(updated.id, actor);
      updated = (await getQuoteVersionDetail(updated.id)) ?? updated;
    } catch (error) {
      console.error('[quote_artifacts] failed to refresh after accept', { quoteVersionId: updated.id, error });
    }
  }
  return {
    quoteVersion: updated,
    invoice: {
      id: appIdFromUuid('inv', accepted.invoice.id),
      invoiceRef: accepted.invoice.invoiceRef,
      sent: accepted.invoice.sent,
      sendError: accepted.invoice.sendError,
      deliveryState: accepted.invoice.deliveryState,
    },
    alreadyAccepted: accepted.alreadyAccepted,
  };
}

export async function markQuoteDeclined(quoteVersionId: string, actor: string | null): Promise<QuoteVersionDetail> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const command = await supabaseServiceRole.rpc('commercial_mark_quote_declined', {
    p_quote_version_id: quoteVersionUuid,
    p_actor: actor,
  } as any);
  if (command.error) {
    if (missingTableError(command.error)) throw schemaMissingError();
    throw new Error(errorMessage(command.error, 'Failed to decline quote'));
  }
  const commandRow = Array.isArray(command.data) ? command.data[0] : command.data;
  const projectUuid = String((commandRow as any)?.project_id ?? '');
  if (projectUuid) {
    await reconcileQuoteOutcomeCadence({
      serviceClient: supabaseServiceRole,
      projectId: projectUuid,
      quoteVersionId: quoteVersionUuid,
      outcome: 'DECLINED',
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
