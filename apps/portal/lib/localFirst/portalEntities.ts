import { asRecord, parseVersionLabel } from './portalEntityValues';
import type { QueryClient } from '@tanstack/react-query';
import type { DesignRequestPriorityTier, DesignRequestSource } from '../designPackages/types';
import { emptyEstimateEditability } from '../estimates/editability';
import { buildEstimateSnapshotPayload } from '../estimates/persistence';
import type { EstimateDetail, EstimateMeta, EstimateSummary } from '../estimates/types';
import { qk } from '../queries/keys';
import { upsertContactAcrossIndexCaches } from '../queries/contactsIndex';
import { patchProjectSnapshot } from '../queries/projectCache';
import type { ProjectNote, ProjectPageSnapshotResponse } from '../projects/types';
import { DEFAULT_QUOTE_TERMS } from '../quotes/defaults';
import {
  applyPaymentScheduleToTerms,
  buildLegacyQuotePaymentSchedule,
  paymentScheduleCompatibilityDepositPercent,
  requireValidQuotePaymentSchedule,
  type QuotePaymentTerm,
} from '../quotes/paymentSchedule';
import type { QuoteLineItem, QuoteVersion, QuoteVersionDetail } from '../quotes/types';
import { totalsFromLineItems } from '../quotes/utils';
import type { Contact } from '../types/contact';

type AnyRecord = Record<string, unknown>;

export const PORTAL_LOCAL_FIRST_MUTATIONS = {
  projectDetailsUpdate: 'portal.project.details.update',
  contactDetailsUpdate: 'portal.contact.details.update',
  estimateCreate: 'portal.estimate.create',
  estimateUpdate: 'portal.estimate.update',
  designRequestCreate: 'portal.designRequest.create',
  quoteCreateFromEstimate: 'portal.quote.createFromEstimate',
  quoteUpdateDraft: 'portal.quote.updateDraft',
  estimateNotesUpdate: 'portal.estimate.notes.update',
  projectNoteCreate: 'portal.project.note.create',
  projectNoteUpdate: 'portal.project.note.update',
  projectNoteDelete: 'portal.project.note.delete',
} as const;

export type PortalEstimatePayload = {
  status: 'draft' | 'archived';
  inputs: AnyRecord;
  derived?: AnyRecord;
  projectSnapshot?: AnyRecord;
  snapshot?: AnyRecord;
  outputs: AnyRecord;
  configVersions?: AnyRecord;
};

export type PortalEstimateCreateMutationPayload = {
  localEstimateId: string;
  projectId: string;
  commercialScopeId?: string | null;
  commercialScopeKind?: 'base' | 'add_on';
  internalName?: string | null;
  estimatePayload: PortalEstimatePayload;
  createDesignRequest?: {
    requestSource: Exclude<DesignRequestSource, 'legacy_backfill'>;
    priorityTier: DesignRequestPriorityTier | null;
  } | null;
};

export type PortalEstimateUpdateMutationPayload = {
  estimateId: string;
  estimatePayload: PortalEstimatePayload;
};

export type PortalQuoteCreateMutationPayload = {
  localQuoteId: string;
  projectId: string;
  estimateId: string;
  internalName?: string | null;
};

export type PortalDesignRequestCreateMutationPayload = {
  projectId: string;
  estimateId: string;
  requestSource: Exclude<DesignRequestSource, 'legacy_backfill'>;
  priorityTier?: DesignRequestPriorityTier | null;
  requestNote?: string | null;
};

type PortalQuoteDraftPatch = {
  reference?: string | null;
  introText?: string | null;
  termsText?: string | null;
  depositPercent?: number;
  paymentTerms?: QuotePaymentTerm[];
  expiresAt?: string | null;
  lineItems?: Array<{ description: string; qty: number; unitPriceIncGstCents: number }>;
};

export type PortalQuoteUpdateMutationPayload = {
  quoteVersionId: string;
  patch: PortalQuoteDraftPatch;
  expectedCommercialRevision: number;
};

export type PortalEstimateNotesMutationPayload = {
  estimateId: string;
  projectId: string;
  internalNotes: string;
};

export type PortalProjectNoteCreateMutationPayload = {
  localNoteId: string;
  projectId: string;
  body: string;
  authorOptimistic: {
    authorId: string;
    authorEmail: string;
    authorDisplayName: string | null;
  };
};

export type PortalProjectNoteUpdateMutationPayload = {
  noteId: string;
  projectId: string;
  body: string;
};

export type PortalProjectNoteDeleteMutationPayload = {
  noteId: string;
  projectId: string;
};

function makeLocalToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nextVersionLabelFromEstimates(estimates: EstimateMeta[]): string {
  const parsed = estimates.map((estimate) => parseVersionLabel(estimate.versionLabel)).filter((value): value is number => value !== null);
  if (parsed.length) return `V${Math.max(...parsed) + 1}`;
  return `V${estimates.length + 1}`;
}

function estimateMetaFromDetail(detail: EstimateDetail): EstimateMeta {
  return {
    id: detail.id,
    projectId: detail.projectId,
    designKind: detail.designKind,
    commercialScopeId: detail.commercialScopeId ?? null,
    commercialScopeKind: detail.commercialScopeKind ?? 'base',
    internalName: detail.internalName,
    createdAt: detail.createdAt,
    status: detail.status,
    summary: detail.summary,
    createdBy: detail.createdBy ?? null,
    versionLabel: detail.versionLabel,
    isActiveDraft: detail.isActiveDraft,
    hasSentQuote: detail.hasSentQuote,
    jobPackEligible: detail.jobPackEligible,
    jobPackGeneratedAt: detail.jobPackGeneratedAt,
    jobPackQuoteVersionId: detail.jobPackQuoteVersionId,
  };
}

function quoteVersionFromDetail(detail: QuoteVersionDetail): QuoteVersion {
  return {
    id: detail.id,
    quoteId: detail.quoteId,
    projectId: detail.projectId,
    commercialScopeId: detail.commercialScopeId ?? null,
    commercialScopeKind: detail.commercialScopeKind ?? 'base',
    quoteRef: detail.quoteRef,
    internalName: detail.internalName,
    versionNumber: detail.versionNumber,
    status: detail.status,
    depositPercent: detail.depositPercent,
    paymentTerms: detail.paymentTerms,
    sourceEstimateVersionId: detail.sourceEstimateVersionId,
    sourceEstimateVersionLabel: detail.sourceEstimateVersionLabel,
    revisedFromQuoteVersionId: detail.revisedFromQuoteVersionId ?? null,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    commercialRevision: detail.commercialRevision,
    isCurrentDraft: detail.isCurrentDraft,
    deliveryPreparedAt: detail.deliveryPreparedAt,
    createdBy: detail.createdBy ?? null,
    sentAt: detail.sentAt ?? null,
    sentBy: detail.sentBy ?? null,
    expiresAt: detail.expiresAt ?? null,
    reference: detail.reference ?? null,
    customerName: detail.customerName ?? null,
    introText: detail.introText ?? null,
    termsText: detail.termsText ?? null,
    totals: detail.totals,
    pdfFileId: detail.pdfFileId ?? null,
    renderHash: detail.renderHash ?? null,
    pricingSource: detail.pricingSource,
  };
}

export function buildCalculatorDraftEntityKey(draftSessionKey: string): string {
  return `calculator:draft:${draftSessionKey}`;
}

export function buildEstimateEntityKey(estimateId: string): string {
  return `estimate:detail:${estimateId}`;
}

export function buildDesignRequestEntityKey(projectId: string, estimateId: string): string {
  return `design-request:${projectId}:${estimateId}`;
}

export function buildEstimateDrawingDraftEntityKey(estimateId: string): string {
  return `estimate:drawing:draft:${estimateId}`;
}

export function buildQuoteEntityKey(quoteVersionId: string): string {
  return `quote:detail:${quoteVersionId}`;
}

export function createLocalEstimateId(): string {
  return `local-estimate:${makeLocalToken()}`;
}

export function createLocalQuoteId(): string {
  return `local-quote:${makeLocalToken()}`;
}

export function createLocalProjectNoteId(): string {
  return `local-note:${makeLocalToken()}`;
}

export function isLocalEstimateId(estimateId: string): boolean {
  return estimateId.startsWith('local-estimate:');
}

export function isLocalQuoteId(quoteVersionId: string): boolean {
  return quoteVersionId.startsWith('local-quote:');
}

export function isLocalProjectNoteId(noteId: string): boolean {
  return noteId.startsWith('local-note:');
}

export function buildProjectNoteEntityKey(noteId: string): string {
  return `project-note:${noteId}`;
}

export function buildEstimatePayloadFromDetail(detail: EstimateDetail): PortalEstimatePayload {
  const snapshot = asRecord(detail.calculatorSnapshot);
  const inputs = (asRecord(snapshot?.inputs) ?? {}) as AnyRecord;
  const outputs = asRecord(snapshot?.outputs) ?? {};
  const { derived, projectSnapshot, snapshot: estimateSnapshot, configVersions, ...baseOutputs } = outputs;

  return {
    status: detail.status,
    inputs,
    derived: (asRecord(derived) ?? {}) as AnyRecord,
    projectSnapshot: (asRecord(projectSnapshot) ?? undefined) as AnyRecord | undefined,
    snapshot: (asRecord(estimateSnapshot) ?? undefined) as AnyRecord | undefined,
    outputs: baseOutputs as AnyRecord,
    configVersions: (asRecord(configVersions) ?? undefined) as AnyRecord | undefined,
  };
}

export function buildOptimisticEstimateDetail(args: {
  estimateId: string;
  projectId: string;
  commercialScopeId?: string | null;
  commercialScopeKind?: 'base' | 'add_on';
  estimatePayload: PortalEstimatePayload;
  versionLabel: string;
  createdBy?: string | null;
  createdAt?: string;
  internalName?: string | null;
}): EstimateDetail {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const built = buildEstimateSnapshotPayload({
    status: args.estimatePayload.status,
    inputs: args.estimatePayload.inputs,
    outputs: args.estimatePayload.outputs,
    derived: args.estimatePayload.derived,
    projectSnapshot: args.estimatePayload.projectSnapshot,
    snapshot: args.estimatePayload.snapshot,
    configVersions: args.estimatePayload.configVersions,
    createdAt,
    updatedAt: createdAt,
  });

  return {
    id: args.estimateId,
    projectId: args.projectId,
    designKind: 'calculator',
    commercialScopeId: args.commercialScopeId ?? null,
    commercialScopeKind: args.commercialScopeKind ?? (args.commercialScopeId ? 'add_on' : 'base'),
    internalName: args.internalName ?? null,
    createdAt,
    status: args.estimatePayload.status,
    summary: built.summaryJson as EstimateSummary,
    createdBy: args.createdBy ?? null,
    versionLabel: args.versionLabel,
    isActiveDraft: true,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
    calculatorSnapshot: built.snapshot,
    internalNotes: null,
    editability: emptyEstimateEditability(),
  };
}

export function buildNextEstimateVersionLabel(estimates: EstimateMeta[]): string {
  return nextVersionLabelFromEstimates(estimates);
}

export function applyDraftPatchToQuoteDetail(detail: QuoteVersionDetail, patch: PortalQuoteDraftPatch): QuoteVersionDetail {
  const nextLineItems: QuoteLineItem[] = Array.isArray(patch.lineItems)
    ? patch.lineItems.map((item, idx) => ({
        id: detail.lineItems[idx]?.id ?? `${detail.id}:line:${idx + 1}`,
        description: String(item.description ?? ''),
        qty: Number.isFinite(item.qty) ? item.qty : 0,
        unitPriceIncGstCents: Number.isFinite(item.unitPriceIncGstCents) ? Math.round(item.unitPriceIncGstCents) : 0,
        lineTotalIncGstCents: (Number.isFinite(item.qty) ? item.qty : 0) * (Number.isFinite(item.unitPriceIncGstCents) ? Math.round(item.unitPriceIncGstCents) : 0),
        sortOrder: idx,
      }))
    : detail.lineItems;

  const totals = totalsFromLineItems(nextLineItems);
  const requestedPaymentTerms = Array.isArray(patch.paymentTerms)
    ? patch.paymentTerms
    : typeof patch.depositPercent === 'number'
      ? buildLegacyQuotePaymentSchedule(totals.totalIncGstCents, patch.depositPercent)
      : detail.paymentTerms ?? buildLegacyQuotePaymentSchedule(totals.totalIncGstCents, detail.depositPercent);
  const nextPaymentTerms = requireValidQuotePaymentSchedule(requestedPaymentTerms, totals.totalIncGstCents);
  const nextDepositPercent = paymentScheduleCompatibilityDepositPercent(nextPaymentTerms, totals.totalIncGstCents);

  return {
    ...detail,
    reference: Object.prototype.hasOwnProperty.call(patch, 'reference') ? patch.reference ?? null : detail.reference ?? null,
    introText: Object.prototype.hasOwnProperty.call(patch, 'introText') ? patch.introText ?? null : detail.introText ?? null,
    termsText:
      Object.prototype.hasOwnProperty.call(patch, 'termsText')
        || Object.prototype.hasOwnProperty.call(patch, 'depositPercent')
        || Object.prototype.hasOwnProperty.call(patch, 'paymentTerms')
        || Array.isArray(patch.lineItems)
        ? applyPaymentScheduleToTerms(patch.termsText ?? detail.termsText ?? DEFAULT_QUOTE_TERMS, nextPaymentTerms)
        : detail.termsText,
    depositPercent: nextDepositPercent,
    paymentTerms: nextPaymentTerms,
    expiresAt: Object.prototype.hasOwnProperty.call(patch, 'expiresAt') ? patch.expiresAt ?? null : detail.expiresAt ?? null,
    lineItems: nextLineItems,
    totals,
    pdfFileId: null,
    renderHash: null,
  };
}

export function upsertEstimateDetailCache(
  queryClient: QueryClient,
  hostKey: string,
  projectId: string,
  detail: EstimateDetail,
  opts?: { prepend?: boolean },
) {
  queryClient.setQueryData(qk.estimates.detail(hostKey, detail.id), detail);
  queryClient.setQueryData<EstimateMeta[]>(qk.estimates.metaByProject(hostKey, projectId), (current) => {
    const list = Array.isArray(current) ? current : [];
    const nextMeta = estimateMetaFromDetail(detail);
    const next = list.slice();
    const idx = next.findIndex((estimate) => estimate.id === detail.id);
    if (idx >= 0) {
      next[idx] = nextMeta;
      return next;
    }
    return opts?.prepend ? [nextMeta, ...next] : [...next, nextMeta];
  });
}
export function replaceEstimateDetailCache(
  queryClient: QueryClient,
  hostKey: string,
  projectId: string,
  previousId: string,
  detail: EstimateDetail,
) {
  queryClient.setQueryData(qk.estimates.detail(hostKey, detail.id), detail);
  queryClient.removeQueries({ queryKey: qk.estimates.detail(hostKey, previousId), exact: true });
  queryClient.setQueryData<EstimateMeta[]>(qk.estimates.metaByProject(hostKey, projectId), (current) => {
    const list = Array.isArray(current) ? current : [];
    const nextMeta = estimateMetaFromDetail(detail);
    const next = list.slice();
    const idx = next.findIndex((estimate) => estimate.id === previousId || estimate.id === detail.id);
    if (idx >= 0) {
      next[idx] = nextMeta;
      return next;
    }
    return [nextMeta, ...next];
  });
}

export function upsertQuoteDetailCache(
  queryClient: QueryClient,
  hostKey: string,
  projectId: string,
  detail: QuoteVersionDetail,
  opts?: { prepend?: boolean },
) {
  queryClient.setQueryData(qk.quotes.detail(hostKey, detail.id), detail);
  queryClient.setQueryData<QuoteVersion[]>(qk.quotes.versionsByProject(hostKey, projectId), (current) => {
    const list = Array.isArray(current) ? current : [];
    const nextVersion = quoteVersionFromDetail(detail);
    const next = list.slice();
    const idx = next.findIndex((quote) => quote.id === detail.id);
    if (idx >= 0) {
      next[idx] = nextVersion;
      return next;
    }
    return opts?.prepend ? [nextVersion, ...next] : [...next, nextVersion];
  });
}

export function replaceQuoteDetailCache(
  queryClient: QueryClient,
  hostKey: string,
  projectId: string,
  previousId: string,
  detail: QuoteVersionDetail,
) {
  queryClient.setQueryData(qk.quotes.detail(hostKey, detail.id), detail);
  queryClient.removeQueries({ queryKey: qk.quotes.detail(hostKey, previousId), exact: true });
  queryClient.setQueryData<QuoteVersion[]>(qk.quotes.versionsByProject(hostKey, projectId), (current) => {
    const list = Array.isArray(current) ? current : [];
    const nextVersion = quoteVersionFromDetail(detail);
    const next = list.slice();
    const idx = next.findIndex((quote) => quote.id === previousId || quote.id === detail.id);
    if (idx >= 0) {
      next[idx] = nextVersion;
      return next;
    }
    return [nextVersion, ...next];
  });
}

export function upsertContactCaches(queryClient: QueryClient, hostKey: string, contact: Contact) {
  queryClient.setQueryData(qk.contacts.detail(hostKey, contact.id), contact);
  upsertContactAcrossIndexCaches(queryClient, hostKey, contact);
}

export function buildOptimisticProjectNote(args: {
  localNoteId: string;
  body: string;
  author: { authorId: string; authorEmail: string; authorDisplayName: string | null };
  createdAt?: string;
}): ProjectNote {
  const createdAt = args.createdAt ?? new Date().toISOString();
  return {
    id: args.localNoteId,
    body: args.body,
    authorId: args.author.authorId,
    authorEmail: args.author.authorEmail,
    authorDisplayName: args.author.authorDisplayName,
    createdAt,
    updatedAt: createdAt,
    isOwn: true,
  };
}

export function insertOptimisticProjectNote(
  queryClient: QueryClient,
  hostKey: string,
  projectId: string,
  note: ProjectNote,
) {
  patchProjectSnapshot(queryClient, hostKey, projectId, (currentSnapshot) => {
    if (!currentSnapshot) return currentSnapshot;
    const existing = currentSnapshot.snapshot.notes ?? [];
    return {
      ...currentSnapshot,
      generatedAt: new Date().toISOString(),
      snapshot: {
        ...currentSnapshot.snapshot,
        notes: [note, ...existing],
      },
    };
  });
}

export function replaceProjectNoteInSnapshot(
  queryClient: QueryClient,
  hostKey: string,
  projectId: string,
  matchId: string,
  next: ProjectNote,
) {
  patchProjectSnapshot(queryClient, hostKey, projectId, (currentSnapshot) => {
    if (!currentSnapshot) return currentSnapshot;
    const existing = currentSnapshot.snapshot.notes ?? [];
    return {
      ...currentSnapshot,
      generatedAt: new Date().toISOString(),
      snapshot: {
        ...currentSnapshot.snapshot,
        notes: existing.map((entry) => (entry.id === matchId ? next : entry)),
      },
    };
  });
}

export function removeProjectNoteFromSnapshot(
  queryClient: QueryClient,
  hostKey: string,
  projectId: string,
  noteId: string,
) {
  patchProjectSnapshot(queryClient, hostKey, projectId, (currentSnapshot) => {
    if (!currentSnapshot) return currentSnapshot;
    const existing = currentSnapshot.snapshot.notes ?? [];
    return {
      ...currentSnapshot,
      generatedAt: new Date().toISOString(),
      snapshot: {
        ...currentSnapshot.snapshot,
        notes: existing.filter((entry) => entry.id !== noteId),
      },
    };
  });
}
