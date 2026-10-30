import type { EstimateDetail } from '../estimates/types';
import { DEFAULT_QUOTE_INTRO, DEFAULT_QUOTE_TERMS } from '../quotes/defaults';
import type { QuoteHandoffPreview } from '../quotes/estimateHandoffPreview';
import { assertQuoteEstimateMappingReady, buildQuoteLineItemsFromEstimate } from '../quotes/calculatorMapping';
import { applyPaymentScheduleToTerms, buildDefaultQuotePaymentSchedule, paymentScheduleCompatibilityDepositPercent } from '../quotes/paymentSchedule';
import type { QuoteLineItem, QuoteVersion, QuoteVersionDetail } from '../quotes/types';
import { totalsFromLineItems } from '../quotes/utils';
import type { Estimate } from '../types/estimate';
import { asRecord, parseVersionLabel } from './portalEntityValues';

/** Calculator preparation is lightweight and refuses Studio sources unless the strict generic owner supplies its mapper. */
function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nextQuoteVersionNumber(quotes: QuoteVersion[]): number {
  const versions = quotes.map((quote) => quote.versionNumber).filter((value) => Number.isFinite(value));
  return versions.length ? Math.max(...versions) + 1 : quotes.length + 1;
}

function toLegacyEstimate(detail: EstimateDetail): Estimate | null {
  const snapshot = asRecord(detail.calculatorSnapshot);
  if (!snapshot) return null;
  const inputs = asRecord(snapshot.inputs) ?? {};
  const outputs = asRecord(snapshot.outputs) ?? {};
  const configVersions = asRecord(outputs.configVersions) ?? {
    pricebook: '',
    installActions: '',
    overheads: '',
    rules: '',
    manifest: '',
  };

  return {
    id: detail.id,
    projectId: detail.projectId,
    version: parseVersionLabel(detail.versionLabel) ?? undefined,
    createdAt: detail.createdAt,
    updatedAt: detail.createdAt,
    status: detail.status,
    inputs: inputs as Estimate['inputs'],
    derived: (asRecord(outputs.derived) ?? {}) as Estimate['derived'],
    projectSnapshot: (asRecord(outputs.projectSnapshot) ?? undefined) as Estimate['projectSnapshot'],
    snapshot: (asRecord(outputs.snapshot) ?? undefined) as Estimate['snapshot'],
    outputs: outputs as Estimate['outputs'],
    configVersions: configVersions as Estimate['configVersions'],
  };
}

function quoteProjectFieldsFromEstimate(detail: EstimateDetail): QuoteVersionDetail['project'] {
  const snapshot = asRecord(detail.calculatorSnapshot);
  const outputs = asRecord(snapshot?.outputs);
  const estimateSnapshot = asRecord(outputs?.snapshot);
  const projectSnapshot = asRecord(outputs?.projectSnapshot);
  const project = asRecord(estimateSnapshot?.project);

  return {
    name: asString(project?.projectName) ?? asString(projectSnapshot?.name) ?? 'Project',
    siteAddress: asString(project?.siteAddress) ?? asString(projectSnapshot?.address) ?? null,
    region: asString(project?.region) ?? asString(projectSnapshot?.region) ?? null,
    quoteRef: asString(project?.quoteRef) ?? asString(projectSnapshot?.quoteRef) ?? null,
  };
}

function quoteContactFieldsFromEstimate(detail: EstimateDetail): QuoteVersionDetail['contact'] {
  const snapshot = asRecord(detail.calculatorSnapshot);
  const outputs = asRecord(snapshot?.outputs);
  const estimateSnapshot = asRecord(outputs?.snapshot);
  const contact = asRecord(estimateSnapshot?.contact);

  return {
    name: asString(contact?.displayName) ?? '',
    email: asString(contact?.email) ?? '',
    phone: asString(contact?.phone),
  };
}

export function buildQuoteHandoffPreviewFromEstimateDetail(
  detail: EstimateDetail, mapEstimate = buildQuoteLineItemsFromEstimate,
): QuoteHandoffPreview {
  const estimate = toLegacyEstimate(detail);
  if (!estimate) {
    return {
      lineItems: [],
      totalIncGstCents: 0,
      blockingIssues: ['The saved estimate snapshot is unavailable for quote handoff.'],
    };
  }
  const mapping = mapEstimate(estimate);
  return {
    lineItems: mapping.items.map(({ description, qty, unitPriceIncGstCents, lineTotalIncGstCents }) =>
      ({ description, qty, unitPriceIncGstCents, lineTotalIncGstCents })),
    totalIncGstCents: mapping.items.reduce((sum, item) => sum + item.lineTotalIncGstCents, 0),
    blockingIssues: mapping.blockingIssues.map(issue => issue.message),
  };
}

export function buildOptimisticQuoteDetail(args: {
  quoteVersionId: string;
  projectId: string;
  estimateDetail: EstimateDetail;
  existingQuotes: QuoteVersion[];
  createdBy?: string | null;
  createdAt?: string;
  internalName?: string | null;
}, mapEstimate = buildQuoteLineItemsFromEstimate): QuoteVersionDetail {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const quoteProject = quoteProjectFieldsFromEstimate(args.estimateDetail);
  const quoteContact = quoteContactFieldsFromEstimate(args.estimateDetail);
  const estimate = toLegacyEstimate(args.estimateDetail);
  const commercialScopeId = args.estimateDetail.commercialScopeId ?? null;
  const scopeQuotes = args.existingQuotes.filter((quote) => (quote.commercialScopeId ?? null) === commercialScopeId);
  const quoteRef = scopeQuotes[0]?.quoteRef ?? (commercialScopeId ? '' : quoteProject.quoteRef ?? '');
  const versionNumber = nextQuoteVersionNumber(scopeQuotes);

  const mapping = estimate ? mapEstimate(estimate) : null;
  if (mapping) assertQuoteEstimateMappingReady(mapping);
  const mappedItems = mapping?.items ?? [];
  const lineItems: QuoteLineItem[] = mappedItems.map((item, idx) => ({
    id: `${args.quoteVersionId}:line:${idx + 1}`,
    description: item.description,
    qty: item.qty,
    unitPriceIncGstCents: item.unitPriceIncGstCents,
    lineTotalIncGstCents: item.lineTotalIncGstCents,
    sortOrder: item.sortOrder,
  }));
  const totals = totalsFromLineItems(lineItems);
  const paymentTerms = buildDefaultQuotePaymentSchedule({
    quoteTotalIncGstCents: totals.totalIncGstCents,
    approvalRequirement: mapping?.approvalRequirement,
    approvalIncGstCents: mapping?.approvalIncGstCents,
  });
  const depositPercent = paymentScheduleCompatibilityDepositPercent(paymentTerms, totals.totalIncGstCents);
  const termsText = applyPaymentScheduleToTerms(DEFAULT_QUOTE_TERMS, paymentTerms);

  return {
    id: args.quoteVersionId,
    quoteId: args.quoteVersionId,
    projectId: args.projectId,
    commercialScopeId,
    commercialScopeKind: args.estimateDetail.commercialScopeKind ?? (commercialScopeId ? 'add_on' : 'base'),
    quoteRef,
    internalName: args.internalName ?? args.estimateDetail.internalName ?? null,
    versionNumber,
    status: 'DRAFT',
    depositPercent,
    paymentTerms,
    sourceEstimateVersionId: args.estimateDetail.id,
    sourceEstimateVersionLabel: args.estimateDetail.versionLabel,
    revisedFromQuoteVersionId: null,
    createdAt,
    updatedAt: createdAt,
    commercialRevision: 1,
    isCurrentDraft: true,
    deliveryPreparedAt: null,
    createdBy: args.createdBy ?? null,
    sentAt: null,
    sentBy: null,
    expiresAt: null,
    reference: null,
    customerName: quoteContact.name || null,
    introText: DEFAULT_QUOTE_INTRO,
    termsText,
    totals,
    pdfFileId: null,
    renderHash: null,
    pricingSource: 'calculator_live',
    lineItems,
    sendLogs: [],
    contact: quoteContact,
    project: quoteProject,
  };
}
