import { projectStudioAuthoringView, type StudioAuthoringView } from './authoringView';
import { parseStudioWebsiteDesign, type StudioWebsiteDesign } from './websiteDesign';
import type { EstimateDetail } from '../estimates/types';
import { buildQuoteHandoffPreviewFromEstimateDetail } from '../localFirst/quotePreparation';
import { requiresConfiguredQuoteSnapshot } from '../quotes/configuredQuoteSnapshot';
import type { QuoteVersionDetail } from '../quotes/types';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1 } from '../types/calculator';
import { parseStudioAuthored, STUDIO_OUTPUT_KEY } from './contracts';

export type SavedReviewLine = {
  description: string;
  qty: number;
  unitPriceIncGstCents: number;
  lineTotalIncGstCents: number;
};
export type SavedReviewPrice =
  | { state: 'available'; totalIncGstCents: number; lineItems: SavedReviewLine[]; basis: 'saved-estimate-handoff' | 'configured-frozen' | 'saved-quote' }
  | { state: 'unavailable'; totalIncGstCents: null; lineItems: []; reason: string };
export type SavedEstimateReview = {
  websiteDesign?: StudioWebsiteDesign;
  websiteComposition?: StudioAuthoringView;
  websiteBrief?: import('./websiteBrief').StudioWebsiteBrief;
  estimate: {
    id: string; projectId: string; versionLabel: string; status: EstimateDetail['status'];
    commercialScopeId: string | null; commercialScopeKind: 'base' | 'add_on';
    lock: EstimateDetail['editability'];
  };
  studio: {
    state: 'absent' | 'unpriced' | 'unsupported';
    designId: string | null; revision: number | null; sourceEstimateId: string | null;
    sourceKind: 'authored' | 'imported' | null;
  };
  currentPrice: SavedReviewPrice;
  sourceEstimate: { id: string; versionLabel: string | null; price: SavedReviewPrice } | null;
  quote: {
    id: string; quoteRef: string; versionNumber: number; status: QuoteVersionDetail['status'];
    sourceEstimateVersionId: string | null; sourceEstimateVersionLabel: string;
    commercialScopeId: string | null; sentAt: string | null;
    pricingSource: QuoteVersionDetail['pricingSource'];
    immutable: boolean; price: SavedReviewPrice;
  } | null;
  nextAction: { kind: 'edit' | 'create-revision' | 'unavailable'; label: string; reason: string | null };
  /** Only constructed after the caller supplies its server-authorised admin role. */
  internalCosts?: { basis: 'retained-source-costs'; materialsExGst: number | null; installExGst: number | null; overheadExGst: number | null; totalExGst: number | null };
};

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const unavailable = (reason: string): SavedReviewPrice => ({ state: 'unavailable', totalIncGstCents: null, lineItems: [], reason });
const money = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const finiteCost = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const scope = (value: { commercialScopeId?: string | null }) => value.commercialScopeId ?? null;

function validLines(lines: SavedReviewLine[], total: unknown): total is number {
  return money(total) && total > 0 && lines.length > 0 && lines.every(line =>
    typeof line.description === 'string' && Boolean(line.description.trim()) &&
    Number.isFinite(line.qty) && line.qty > 0 && money(line.unitPriceIncGstCents) && money(line.lineTotalIncGstCents),
  ) && lines.reduce((sum, line) => sum + line.lineTotalIncGstCents, 0) === total;
}

function savedEstimatePrice(detail: EstimateDetail): SavedReviewPrice {
  const snapshot = record(detail.calculatorSnapshot);
  const outputs = record(snapshot?.outputs);
  if (!snapshot || !outputs || Object.hasOwn(outputs, STUDIO_OUTPUT_KEY)) {
    return unavailable('This authored revision has no verified price. Original estimate pricing is reference only.');
  }
  const inputs = snapshot.inputs;
  const pricingMode = record(outputs.derived)?.pricingMode;
  if ((outputs.cost_snapshot_version !== undefined && !['v1', 'v2'].includes(String(outputs.cost_snapshot_version))) ||
    (pricingMode !== undefined && pricingMode !== 'configured_customer_snapshot')) {
    return unavailable('The saved pricing source version is unsupported.');
  }
  if (!isCalculatorInputsV2(inputs) && !isLegacyCalculatorInputsV1(inputs)) {
    return unavailable('The saved estimate inputs are missing or unsupported.');
  }
  const configured = requiresConfiguredQuoteSnapshot({ inputs, derived: outputs.derived, snapshot: outputs.snapshot });
  if (!configured && finiteCost(record(outputs.totals)?.cost_ex_gst) === null) {
    return unavailable('The saved costing evidence is incomplete.');
  }
  if (isCalculatorInputsV2(inputs) && inputs.modules.length === 0) {
    const hasItems = (value: unknown, key: string) => Array.isArray(record(value)?.[key]) && (record(value)![key] as unknown[]).length > 0;
    const hasAddons = hasItems(inputs.blinds, 'items') || hasItems(inputs.standaloneInfills, 'items') || hasItems(inputs.additionalAluminium, 'rows');
    if (!hasAddons) return unavailable('This estimate contains no design or add-on items to review.');
  }
  try {
    // This existing owner validates complete configured snapshots and applies the
    // historical estimate handoff policy. Never use summary.total/cost fallback.
    const preview = buildQuoteHandoffPreviewFromEstimateDetail(detail);
    if (preview.blockingIssues.length) return unavailable(preview.blockingIssues.join(' '));
    if (!validLines(preview.lineItems, preview.totalIncGstCents)) return unavailable('The saved selling breakdown is incomplete.');
    return { state: 'available', totalIncGstCents: preview.totalIncGstCents, lineItems: preview.lineItems.map(line => ({ ...line })), basis: configured ? 'configured-frozen' : 'saved-estimate-handoff' };
  } catch {
    return unavailable('The saved estimate cannot provide a complete selling breakdown.');
  }
}

function quoteReview(quote: QuoteVersionDetail, estimate: EstimateDetail): NonNullable<SavedEstimateReview['quote']> {
  const associated = quote.sourceEstimateVersionId === estimate.id && quote.projectId === estimate.projectId &&
    scope(quote) === scope(estimate) && (quote.commercialScopeKind ?? 'base') === (estimate.commercialScopeKind ?? 'base');
  const lines = Array.isArray(quote.lineItems) ? quote.lineItems.map(line => ({
    description: line.description, qty: line.qty, unitPriceIncGstCents: line.unitPriceIncGstCents,
    lineTotalIncGstCents: line.lineTotalIncGstCents,
  })) : [];
  const totals = quote.totals;
  const complete = totals && validLines(lines, totals.totalIncGstCents) && money(totals.totalExGstCents) &&
    money(totals.gstCents) && totals.totalExGstCents + totals.gstCents === totals.totalIncGstCents;
  const known = ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'SUPERSEDED'].includes(quote.status) &&
    Number.isSafeInteger(quote.versionNumber) && quote.versionNumber > 0 &&
    ['calculator_live', 'workbench_solved', 'manual'].includes(quote.pricingSource);
  return {
    id: quote.id, quoteRef: quote.quoteRef, versionNumber: quote.versionNumber, status: quote.status,
    sourceEstimateVersionId: quote.sourceEstimateVersionId, sourceEstimateVersionLabel: quote.sourceEstimateVersionLabel,
    commercialScopeId: scope(quote), sentAt: quote.sentAt ?? null,
    pricingSource: quote.pricingSource,
    immutable: quote.status !== 'DRAFT' || Boolean(quote.sentAt),
    price: !associated ? unavailable('This quote does not belong to this estimate, project and scope.')
      : !known || !complete ? unavailable('The saved quote version or frozen totals are incomplete.')
        : { state: 'available', totalIncGstCents: totals.totalIncGstCents, lineItems: lines, basis: 'saved-quote' },
  };
}

/** Pure allowlisted projection. It does not fetch, reprice, save or authorise.
 * Pass quote versions loaded through the authenticated authoritative owner.
 * Omission of currentStudioDraft cannot bypass a saved authored marker. */
export function buildSavedEstimateReview(args: {
  estimate: EstimateDetail;
  quote?: QuoteVersionDetail | null;
  /** Explicit original source; never reconstruct a price from opaque provenance JSON. */
  sourceEstimate?: EstimateDetail | null;
  currentStudioDraft?: unknown;
  viewerRole: 'staff' | 'admin';
}): SavedEstimateReview {
  const { estimate } = args;
  const outputs = record(record(estimate.calculatorSnapshot)?.outputs);
  const savedMarker = Boolean(outputs && Object.hasOwn(outputs, STUDIO_OUTPUT_KEY));
  const draftPresent = Object.hasOwn(args, 'currentStudioDraft');
  const saved = savedMarker ? parseStudioAuthored(outputs![STUDIO_OUTPUT_KEY]) : null;
  const draft = draftPresent ? parseStudioAuthored(args.currentStudioDraft) : null;
  const unsupported = (saved !== null && !saved.ok) || (draft !== null && !draft.ok) ||
    Boolean(saved?.ok && draft?.ok && (saved.value.designId !== draft.value.designId ||
      saved.value.provenance.sourceEstimateId !== draft.value.provenance.sourceEstimateId));
  const authored = draft?.ok ? draft.value : saved?.ok ? saved.value : null;
  const sourceId = saved?.ok ? saved.value.provenance.sourceEstimateId : authored?.provenance.sourceEstimateId ?? null;
  const source = args.sourceEstimate;
  const matchingSource = source && source.id === sourceId && source.projectId === estimate.projectId &&
    scope(source) === scope(estimate) && (source.commercialScopeKind ?? 'base') === (estimate.commercialScopeKind ?? 'base');
  const nextAction: SavedEstimateReview['nextAction'] = unsupported
    ? { kind: 'unavailable', label: 'Review unavailable', reason: 'This saved or draft studio version is unsupported. Reload with a compatible client.' }
    : estimate.editability.isLocked || estimate.status === 'archived'
      || estimate.editability.hasDraftQuotes || estimate.editability.draftQuoteCount > 0
      ? { kind: 'create-revision', label: 'Create revision', reason: 'The source estimate is archived or already used by a quote.' }
      : { kind: 'edit', label: 'Return to editing', reason: null };
  const result: SavedEstimateReview = {
    estimate: {
      id: estimate.id, projectId: estimate.projectId, versionLabel: estimate.versionLabel, status: estimate.status,
      commercialScopeId: scope(estimate), commercialScopeKind: estimate.commercialScopeKind ?? 'base',
      lock: {
        isLocked: estimate.editability.isLocked, lockReason: estimate.editability.lockReason,
        lockedAt: estimate.editability.lockedAt, lockedByQuoteVersionId: estimate.editability.lockedByQuoteVersionId,
        lockedByQuoteRef: estimate.editability.lockedByQuoteRef,
        lockedByQuoteVersionNumber: estimate.editability.lockedByQuoteVersionNumber,
        hasDraftQuotes: estimate.editability.hasDraftQuotes, draftQuoteCount: estimate.editability.draftQuoteCount,
      },
    },
    studio: {
      state: unsupported ? 'unsupported' : savedMarker || draftPresent ? 'unpriced' : 'absent',
      designId: authored?.designId ?? null, revision: authored?.revision ?? null,
      sourceEstimateId: sourceId, sourceKind: authored?.provenance.sourceKind ?? null,
    },
    currentPrice: savedMarker || draftPresent
      ? unavailable(unsupported ? 'This studio revision is unsupported; its price is unavailable.' : 'This authored revision is unpriced. Saved source prices do not price these changes.')
      : savedEstimatePrice(estimate),
    sourceEstimate: matchingSource ? { id: source.id, versionLabel: source.versionLabel, price: savedEstimatePrice(source) }
      : sourceId ? { id: sourceId, versionLabel: null, price: unavailable('The matching original source estimate is unavailable.') } : null,
    quote: args.quote ? quoteReview(args.quote, estimate) : null,
    nextAction,
  };
  if (!args.quote && authored) {
    const row=authored.objectOptions[0];
    const website=row?parseStudioWebsiteDesign(row.options.values.websiteDesign,row.objectId):null;
    if (website?.ok || authored.objectOptions.length===0) {
      const projected=projectStudioAuthoringView({authored,spatial:outputs?.drawing_object_first});
      if(projected.ok&&(website?.ok||(projected.value.spatial.pergolas.length===0&&projected.value.spatial.decks.length===0&&projected.value.spatial.openings.length===0))){if(website?.ok)result.websiteDesign=website.value;result.websiteComposition=projected.value;}
    }
  }
  if (args.viewerRole === 'admin' && outputs) {
    result.internalCosts = {
      basis: 'retained-source-costs',
      materialsExGst: finiteCost(record(record(outputs.materials)?.totals)?.materials_ex_gst),
      installExGst: finiteCost(record(record(outputs.install)?.totals)?.install_ex_gst),
      overheadExGst: finiteCost(record(outputs.overhead)?.total_ex_gst),
      totalExGst: finiteCost(record(outputs.totals)?.cost_ex_gst),
    };
  }
  return result;
}
