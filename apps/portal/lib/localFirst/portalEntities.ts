import type { QueryClient } from '@tanstack/react-query';
import { emptyEstimateEditability } from '../estimates/editability';
import { buildEstimateSnapshotPayload } from '../estimates/persistence';
import type { EstimateDetail, EstimateMeta, EstimateSummary } from '../estimates/types';
import { qk } from '../queries/keys';
import { patchProjectListItem, patchProjectSnapshot } from '../queries/projectCache';
import type { ProjectPageSnapshotResponse, ProjectTaskItem } from '../projects/types';
import { DEFAULT_QUOTE_INTRO, DEFAULT_QUOTE_TERMS, applyDepositPercentToTerms } from '../quotes/defaults';
import { buildQuoteLineItemsFromEstimate } from '../quotes/mapping';
import type { QuoteLineItem, QuoteVersion, QuoteVersionDetail } from '../quotes/types';
import { totalsFromLineItems } from '../quotes/utils';
import type { Contact } from '../types/contact';
import type { Estimate } from '../types/estimate';
import type { Project } from '../types/project';

type AnyRecord = Record<string, unknown>;

export const PORTAL_LOCAL_FIRST_MUTATIONS = {
  estimateCreate: 'portal.estimate.create',
  estimateUpdate: 'portal.estimate.update',
  quoteCreateFromEstimate: 'portal.quote.createFromEstimate',
  quoteUpdateDraft: 'portal.quote.updateDraft',
  projectDetailsUpdate: 'portal.project.details.update',
  estimateNotesUpdate: 'portal.estimate.notes.update',
  projectTaskToggle: 'portal.project.tasks.toggle',
  contactUpdate: 'portal.contact.update',
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
  estimatePayload: PortalEstimatePayload;
  createDesignRequest?: {
    requestSource: 'calculator_generate';
    priorityTier: string;
  } | null;
};

export type PortalEstimateUpdateMutationPayload = {
  estimateId: string;
  estimatePayload: PortalEstimatePayload;
  acknowledgeDraftQuoteStaleness: boolean;
};

export type PortalQuoteCreateMutationPayload = {
  localQuoteId: string;
  projectId: string;
  estimateId: string;
};

export type PortalQuoteDraftPatch = {
  reference?: string | null;
  introText?: string | null;
  termsText?: string | null;
  depositPercent?: number;
  expiresAt?: string | null;
  lineItems?: Array<{ description: string; qty: number; unitPriceIncGstCents: number }>;
};

export type PortalQuoteUpdateMutationPayload = {
  quoteVersionId: string;
  patch: PortalQuoteDraftPatch;
};

export type PortalProjectDetailsDraft = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  projectName: string;
  siteAddress: string;
  region: string;
  quoteRef: string;
  nextActionDate: string;
};

export type PortalProjectDetailsMutationPayload = {
  projectId: string;
  contactId: string | null;
  draft: PortalProjectDetailsDraft;
};

export type PortalEstimateNotesMutationPayload = {
  estimateId: string;
  projectId: string;
  internalNotes: string;
};

export type PortalProjectTaskToggleMutationPayload = {
  projectId: string;
  taskKey: string;
  completed: boolean;
};

export type PortalContactDraft = {
  displayName: string;
  email: string;
  phone: string;
};

export type PortalContactUpdateMutationPayload = {
  contactId: string;
  draft: PortalContactDraft;
};

function makeLocalToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseVersionLabel(label: string): number | null {
  const match = String(label ?? '').trim().match(/^V(\d+)$/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function nextVersionLabelFromEstimates(estimates: EstimateMeta[]): string {
  const parsed = estimates.map((estimate) => parseVersionLabel(estimate.versionLabel)).filter((value): value is number => value !== null);
  if (parsed.length) return `V${Math.max(...parsed) + 1}`;
  return `V${estimates.length + 1}`;
}

function nextQuoteVersionNumber(quotes: QuoteVersion[]): number {
  const versions = quotes.map((quote) => quote.versionNumber).filter((value) => Number.isFinite(value));
  return versions.length ? Math.max(...versions) + 1 : quotes.length + 1;
}

function estimateMetaFromDetail(detail: EstimateDetail): EstimateMeta {
  return {
    id: detail.id,
    projectId: detail.projectId,
    createdAt: detail.createdAt,
    status: detail.status,
    summary: detail.summary,
    createdBy: detail.createdBy ?? null,
    versionLabel: detail.versionLabel,
  };
}

function quoteVersionFromDetail(detail: QuoteVersionDetail): QuoteVersion {
  return {
    id: detail.id,
    quoteId: detail.quoteId,
    projectId: detail.projectId,
    quoteRef: detail.quoteRef,
    versionNumber: detail.versionNumber,
    status: detail.status,
    depositPercent: detail.depositPercent,
    sourceEstimateVersionId: detail.sourceEstimateVersionId,
    sourceEstimateVersionLabel: detail.sourceEstimateVersionLabel,
    revisedFromQuoteVersionId: detail.revisedFromQuoteVersionId ?? null,
    createdAt: detail.createdAt,
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
  };
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

export function buildCalculatorDraftEntityKey(draftSessionKey: string): string {
  return `calculator:draft:${draftSessionKey}`;
}

export function buildProjectDetailsEntityKey(projectId: string): string {
  return `project:details:${projectId}`;
}

export function buildProjectDetailsDraftEntityKey(projectId: string): string {
  return `project:details:draft:${projectId}`;
}

export function buildEstimateEntityKey(estimateId: string): string {
  return `estimate:detail:${estimateId}`;
}

export function buildEstimateNotesDraftEntityKey(estimateId: string): string {
  return `estimate:notes:draft:${estimateId}`;
}

export function buildQuoteEntityKey(quoteVersionId: string): string {
  return `quote:detail:${quoteVersionId}`;
}

export function buildProjectTasksEntityKey(projectId: string): string {
  return `project:tasks:${projectId}`;
}

export function buildProjectTasksDraftEntityKey(projectId: string): string {
  return `project:tasks:draft:${projectId}`;
}

export function buildContactEntityKey(contactId: string): string {
  return `contact:detail:${contactId}`;
}

export function buildContactDraftEntityKey(contactId: string): string {
  return `contact:detail:draft:${contactId}`;
}

export function createLocalEstimateId(): string {
  return `local-estimate:${makeLocalToken()}`;
}

export function createLocalQuoteId(): string {
  return `local-quote:${makeLocalToken()}`;
}

export function isLocalEstimateId(estimateId: string): boolean {
  return estimateId.startsWith('local-estimate:');
}

export function isLocalQuoteId(quoteVersionId: string): boolean {
  return quoteVersionId.startsWith('local-quote:');
}

export function buildOptimisticEstimateDetail(args: {
  estimateId: string;
  projectId: string;
  estimatePayload: PortalEstimatePayload;
  versionLabel: string;
  createdBy?: string | null;
  createdAt?: string;
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
    createdAt,
    status: args.estimatePayload.status,
    summary: built.summaryJson as EstimateSummary,
    createdBy: args.createdBy ?? null,
    versionLabel: args.versionLabel,
    calculatorSnapshot: built.snapshot,
    internalNotes: null,
    editability: emptyEstimateEditability(),
  };
}

export function buildNextEstimateVersionLabel(estimates: EstimateMeta[]): string {
  return nextVersionLabelFromEstimates(estimates);
}

export function buildOptimisticQuoteDetail(args: {
  quoteVersionId: string;
  projectId: string;
  estimateDetail: EstimateDetail;
  existingQuotes: QuoteVersion[];
  createdBy?: string | null;
  createdAt?: string;
}): QuoteVersionDetail {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const quoteProject = quoteProjectFieldsFromEstimate(args.estimateDetail);
  const quoteContact = quoteContactFieldsFromEstimate(args.estimateDetail);
  const estimate = toLegacyEstimate(args.estimateDetail);
  const quoteRef = quoteProject.quoteRef ?? '';
  const versionNumber = nextQuoteVersionNumber(args.existingQuotes);

  const mappedItems = estimate ? buildQuoteLineItemsFromEstimate(estimate).items : [];
  const lineItems: QuoteLineItem[] = mappedItems.map((item, idx) => ({
    id: `${args.quoteVersionId}:line:${idx + 1}`,
    description: item.description,
    qty: item.qty,
    unitPriceIncGstCents: item.unitPriceIncGstCents,
    lineTotalIncGstCents: item.lineTotalIncGstCents,
    sortOrder: item.sortOrder,
  }));
  const totals = totalsFromLineItems(lineItems);
  const depositPercent = 50;
  const termsText = applyDepositPercentToTerms(DEFAULT_QUOTE_TERMS, depositPercent);

  return {
    id: args.quoteVersionId,
    quoteId: args.quoteVersionId,
    projectId: args.projectId,
    quoteRef,
    versionNumber,
    status: 'DRAFT',
    depositPercent,
    sourceEstimateVersionId: args.estimateDetail.id,
    sourceEstimateVersionLabel: args.estimateDetail.versionLabel,
    revisedFromQuoteVersionId: null,
    createdAt,
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
    lineItems,
    sendLogs: [],
    contact: quoteContact,
    project: quoteProject,
  };
}

export function applyDraftPatchToQuoteDetail(detail: QuoteVersionDetail, patch: PortalQuoteDraftPatch): QuoteVersionDetail {
  const nextDepositPercent = typeof patch.depositPercent === 'number' ? patch.depositPercent : detail.depositPercent;
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

  return {
    ...detail,
    reference: Object.prototype.hasOwnProperty.call(patch, 'reference') ? patch.reference ?? null : detail.reference ?? null,
    introText: Object.prototype.hasOwnProperty.call(patch, 'introText') ? patch.introText ?? null : detail.introText ?? null,
    termsText:
      Object.prototype.hasOwnProperty.call(patch, 'termsText') || Object.prototype.hasOwnProperty.call(patch, 'depositPercent')
        ? applyDepositPercentToTerms(patch.termsText ?? detail.termsText ?? DEFAULT_QUOTE_TERMS, nextDepositPercent)
        : detail.termsText,
    depositPercent: nextDepositPercent,
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

export function normalizeProjectDetailsDraft(draft: PortalProjectDetailsDraft): PortalProjectDetailsDraft {
  return {
    contactName: draft.contactName.trim(),
    contactEmail: draft.contactEmail.trim(),
    contactPhone: draft.contactPhone.trim(),
    projectName: draft.projectName.trim(),
    siteAddress: draft.siteAddress.trim(),
    region: draft.region.trim(),
    quoteRef: draft.quoteRef.trim(),
    nextActionDate: draft.nextActionDate.trim(),
  };
}

export function patchProjectDetailsCaches(
  queryClient: QueryClient,
  hostKey: string,
  projectId: string,
  draft: PortalProjectDetailsDraft,
  options?: { contactId?: string | null },
) {
  const normalized = normalizeProjectDetailsDraft(draft);

  patchProjectSnapshot(queryClient, hostKey, projectId, (currentSnapshot) => {
    if (!currentSnapshot) return currentSnapshot;
    return {
      ...currentSnapshot,
      generatedAt: new Date().toISOString(),
      snapshot: {
        ...currentSnapshot.snapshot,
        project: {
          ...currentSnapshot.snapshot.project,
          name: normalized.projectName || currentSnapshot.snapshot.project.name,
          contactName: normalized.contactName || undefined,
          contactEmail: normalized.contactEmail || undefined,
          contactPhone: normalized.contactPhone || undefined,
          siteAddress: normalized.siteAddress || undefined,
          region: normalized.region || undefined,
          quoteRef: normalized.quoteRef || undefined,
          nextActionDate: normalized.nextActionDate || undefined,
        },
      },
    };
  });

  queryClient.setQueryData<Project | null | undefined>(qk.projects.detail(hostKey, projectId), (currentProject) => {
    if (!currentProject) return currentProject;
    return {
      ...currentProject,
      projectName: normalized.projectName || currentProject.projectName || currentProject.name,
      name: normalized.projectName || currentProject.projectName || currentProject.name,
      region: normalized.region || undefined,
      quoteRef: normalized.quoteRef || undefined,
      siteAddress: normalized.siteAddress || undefined,
      address: normalized.siteAddress || undefined,
      nextActionDate: normalized.nextActionDate || null,
      followUpDate: normalized.nextActionDate || null,
      clientName: normalized.contactName || currentProject.clientName,
      email: normalized.contactEmail || currentProject.email,
      phone: normalized.contactPhone || currentProject.phone,
    };
  });

  patchProjectListItem(queryClient, hostKey, projectId, (currentProject) => ({
    ...currentProject,
    projectName: normalized.projectName || currentProject.projectName || currentProject.name,
    name: normalized.projectName || currentProject.projectName || currentProject.name,
    region: normalized.region || undefined,
    quoteRef: normalized.quoteRef || undefined,
    siteAddress: normalized.siteAddress || undefined,
    address: normalized.siteAddress || undefined,
    nextActionDate: normalized.nextActionDate || null,
    followUpDate: normalized.nextActionDate || null,
    clientName: normalized.contactName || currentProject.clientName,
    email: normalized.contactEmail || currentProject.email,
    phone: normalized.contactPhone || currentProject.phone,
  }));

  const contactId = options?.contactId ?? null;
  if (!contactId) return;

  queryClient.setQueryData<Project[] | undefined>(qk.projects.byContact(hostKey, contactId), (currentProjects) => {
    if (!Array.isArray(currentProjects)) return currentProjects;
    return currentProjects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            projectName: normalized.projectName || project.projectName || project.name,
            name: normalized.projectName || project.projectName || project.name,
            region: normalized.region || undefined,
            quoteRef: normalized.quoteRef || undefined,
            siteAddress: normalized.siteAddress || undefined,
            address: normalized.siteAddress || undefined,
            nextActionDate: normalized.nextActionDate || null,
            followUpDate: normalized.nextActionDate || null,
            clientName: normalized.contactName || project.clientName,
          }
        : project,
    );
  });
}

export function upsertContactCaches(queryClient: QueryClient, hostKey: string, contact: Contact) {
  queryClient.setQueryData(qk.contacts.detail(hostKey, contact.id), contact);
  queryClient.setQueryData<Contact[] | undefined>(qk.contacts.list(hostKey), (currentContacts) => {
    if (!Array.isArray(currentContacts)) return currentContacts;
    const next = currentContacts.filter((entry) => entry.id !== contact.id);
    next.push(contact);
    next.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
    return next;
  });
}

export function patchProjectTasksSnapshot(
  queryClient: QueryClient,
  hostKey: string,
  projectId: string,
  items: ProjectTaskItem[],
) {
  patchProjectSnapshot(queryClient, hostKey, projectId, (currentSnapshot) => {
    if (!currentSnapshot) return currentSnapshot;
    return {
      ...currentSnapshot,
      generatedAt: new Date().toISOString(),
      snapshot: {
        ...currentSnapshot.snapshot,
        tasks: {
          ...currentSnapshot.snapshot.tasks,
          items,
        },
      },
    };
  });
}
