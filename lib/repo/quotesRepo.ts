import type { Quote, QuoteContent, QuoteStatus } from '@/lib/types/quote';
import type { Estimate } from '@/lib/types/estimate';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1 } from '@/lib/types/calculator';
import type { Project } from '@/lib/types/project';
import { getContact } from '@/lib/repo/contactsRepo';
import { addProjectActivity, getProject } from '@/lib/repo/projectsRepo';
import { getEstimate } from '@/lib/repo/estimatesRepo';
import { apiJson } from '@/lib/repo/apiClient';
import { newId } from '@/lib/utils/id';
import { nowIso } from '@/lib/utils/time';
import { ensureQuotesMigration } from './migrations';
import { readJson, writeJson } from './storage';

const QUOTES_KEY = 'sp_quotes_v1';

function readAllCache(): Quote[] {
  ensureQuotesMigration();
  const quotes = readJson<Quote[]>(QUOTES_KEY, []);
  return Array.isArray(quotes) ? quotes : [];
}

function writeAllCache(quotes: Quote[]) {
  writeJson<Quote[]>(QUOTES_KEY, quotes);
}

function upsertQuoteCache(quote: Quote): Quote {
  const quotes = readAllCache();
  const idx = quotes.findIndex((q) => q.id === quote.id);
  const next = quotes.slice();
  if (idx >= 0) next[idx] = quote;
  else next.push(quote);
  writeAllCache(next);
  return quote;
}

async function listAllQuotes(): Promise<Quote[]> {
  try {
    const res = await apiJson<{ quotes: Quote[] }>('/api/staff/v1/quotes', { skipSaveTracking: true });
    const quotes = Array.isArray(res.quotes) ? res.quotes : [];
    writeAllCache(quotes);
    return quotes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return readAllCache().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export async function listQuotesByProject(projectId: string): Promise<Quote[]> {
  try {
    const res = await apiJson<{ quotes: Quote[] }>(`/api/staff/v1/quotes?projectId=${encodeURIComponent(projectId)}`, { skipSaveTracking: true });
    const quotes = Array.isArray(res.quotes) ? res.quotes : [];
    const merged = readAllCache().filter((q) => q.projectId !== projectId);
    writeAllCache([...merged, ...quotes]);
    return quotes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return readAllCache()
      .filter((q) => q.projectId === projectId)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export async function getQuote(id: string): Promise<Quote | null> {
  const cached = readAllCache().find((q) => q.id === id) ?? null;
  if (cached) return cached;
  try {
    const res = await apiJson<{ quote: Quote }>(`/api/staff/v1/quotes/${encodeURIComponent(id)}`, { skipSaveTracking: true });
    return upsertQuoteCache(res.quote);
  } catch {
    return null;
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? '');
  }
}

function modulesSummaryFromInputs(inputs: unknown): string[] {
  if (isCalculatorInputsV2(inputs)) {
    const modules = inputs.modules ?? [];
    return modules.map((m, idx) => {
      const base =
        m?.pergolaStyle === 'hip_corner'
          ? `${m.pergolaStyle}, ${m.roofMaterial}, A:${m.lengthM}×${m.projectionM} B:${m.hipCornerLengthBM}×${m.hipCornerProjectionBM}m`
          : `${m?.pergolaStyle ?? '—'}, ${m?.roofMaterial ?? '—'}, ${m?.lengthM ?? '—'}×${m?.projectionM ?? '—'}m`;
      return `Module ${idx + 1}: ${base}`;
    });
  }
  if (isLegacyCalculatorInputsV1(inputs)) {
    return [`Module 1: ${inputs.pergolaStyle}, ${inputs.roofMaterial}, ${inputs.lengthM}×${inputs.projectionM}m`];
  }
  return ['Module 1: —'];
}

function estimateSummaryText(project: Project, estimate: Estimate): string {
  const projectName = project.projectName ?? project.name ?? 'Project';
  const estimateLabel = typeof estimate.version === 'number' ? `Estimate v${estimate.version}` : `Estimate (${estimate.createdAt})`;
  return `${projectName} · ${estimateLabel}`;
}

function defaultQuoteContent(project: Project): QuoteContent {
  const projectName = project.projectName ?? project.name ?? '';
  return {
    heading: projectName ? `Quote for ${projectName}` : 'Quote',
    intro: '',
    scope: '',
    inclusions: '',
    exclusions: '',
    assumptions: '',
    terms: '',
  };
}

type CreateQuoteOverrides = {
  quoteNumber?: string;
  customerTotalOverride?: number | null;
  notes?: string | null;
};

function normaliseQuoteNumber(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v ? v : undefined;
}

function parseQuoteNumberSequence(value: string): { year: number; seq: number } | null {
  const m = /^Q-(\d{4})-(\d{4,})$/i.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const seq = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(seq)) return null;
  return { year, seq };
}

export async function suggestNextQuoteNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const maxSeq = (await listAllQuotes())
    .map((q) => (q.quoteNumber ? parseQuoteNumberSequence(q.quoteNumber) : null))
    .filter((x): x is NonNullable<typeof x> => Boolean(x && x.year === year))
    .reduce((max, x) => Math.max(max, x.seq), 0);

  const nextSeq = maxSeq + 1;
  const padded = String(nextSeq).padStart(4, '0');
  return `Q-${year}-${padded}`;
}

export async function createQuoteFromEstimate(projectId: string, estimateId: string, overrides?: CreateQuoteOverrides): Promise<Quote> {
  const project = await getProject(projectId);
  if (!project) throw new Error('Project not found.');
  const estimate = await getEstimate(estimateId);
  if (!estimate) throw new Error('Estimate not found.');
  if (estimate.projectId !== projectId) throw new Error('Estimate does not belong to this project.');

  const contactId = project.contactId;
  const contact = contactId ? await getContact(contactId) : null;
  if (!contact) throw new Error('Project is missing a contact.');

  const totalsEx = estimate.outputs?.totals?.cost_ex_gst ?? 0;
  const totalsInc = estimate.outputs?.totals?.cost_inc_gst ?? 0;
  const gst = totalsInc - totalsEx;

  const now = nowIso();
  const quoteId = newId('quo');
  const quoteNumber = normaliseQuoteNumber(overrides?.quoteNumber) ?? (await suggestNextQuoteNumber());
  const customerTotalOverride =
    typeof overrides?.customerTotalOverride === 'number' && Number.isFinite(overrides.customerTotalOverride)
      ? overrides.customerTotalOverride
      : overrides?.customerTotalOverride === null
        ? null
        : totalsInc;
  const notes = typeof overrides?.notes === 'string' ? overrides.notes : null;

  const quote: Quote = {
    id: quoteId,
    projectId,
    rootQuoteId: quoteId,
    quoteNumber,
    sourceEstimateId: estimate.id,
    sourceEstimateVersion: typeof estimate.version === 'number' ? estimate.version : estimate.createdAt,
    version: 1,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    contactSnapshot: {
      name: contact.displayName,
      email: contact.email,
      phone: contact.phone,
      address: project.siteAddress ?? project.address,
    },
    projectSnapshot: {
      projectName: project.projectName ?? project.name ?? '',
      quoteRef: project.quoteRef,
      region: project.region,
      siteAddress: project.siteAddress ?? project.address,
    },
    pricingSnapshot: {
      currency: 'NZD',
      totalExGst: totalsEx,
      totalIncGst: totalsInc,
      gstAmount: gst,
    },
    estimateSnapshot: {
      summaryText: estimateSummaryText(project, estimate),
      modulesSummary: modulesSummaryFromInputs(estimate.inputs as unknown),
      rawInputsJson: safeJsonStringify(estimate.inputs as unknown),
      bomSummary: {
        lines: estimate.outputs?.materials?.lines?.length ?? 0,
        materialsExGst: estimate.outputs?.materials?.totals?.materials_ex_gst ?? 0,
      },
      installMinutesSummary: {
        actions: estimate.outputs?.install?.actions?.length ?? 0,
        crewMinutes: estimate.outputs?.install?.totals?.crew_minutes ?? 0,
      },
      derived: estimate.derived,
      outputs: estimate.outputs,
      configVersions: estimate.configVersions,
    },
    estimateSnapshotFull: estimate,
    content: defaultQuoteContent(project),
    customerTotalOverride,
    notes,
  };

  await apiJson<{ quote: Quote }>('/api/staff/v1/quotes', { method: 'POST', body: JSON.stringify({ quote }) });
  upsertQuoteCache(quote);

  await addProjectActivity(projectId, {
    type: 'quote_created',
    message: `${quoteNumber} created from estimate v${estimate.version ?? '—'} (ex-GST: $${totalsEx.toFixed(2)})`,
    meta: {
      quoteId: quote.id,
      version: quote.version,
      quoteNumber,
      status: quote.status,
      sourceEstimateId: quote.sourceEstimateId,
      sourceEstimateVersion: quote.sourceEstimateVersion,
      totalsExGst: totalsEx,
      totalsIncGst: totalsInc,
    },
  });

  return quote;
}

type DraftPatch = Partial<Pick<Quote, 'content' | 'quoteNumber' | 'customerTotalOverride' | 'notes'>>;

function patchHasAnyKey(patch: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((k) => Object.prototype.hasOwnProperty.call(patch, k));
}

export async function updateQuote(quoteId: string, patch: DraftPatch): Promise<Quote> {
  const prev = await getQuote(quoteId);
  if (!prev) throw new Error('Quote not found');

  if (prev.status !== 'draft') {
    throw new Error('This quote is locked. Duplicate as a revision to edit.');
  }

  if (
    patchHasAnyKey(patch as Record<string, unknown>, [
      'id',
      'projectId',
      'rootQuoteId',
      'sourceEstimateId',
      'sourceEstimateVersion',
      'version',
      'status',
      'createdAt',
      'updatedAt',
      'sentAt',
      'paidAt',
      'contactSnapshot',
      'projectSnapshot',
      'pricingSnapshot',
      'estimateSnapshot',
      'estimateSnapshotFull',
    ])
  ) {
    throw new Error('Attempted to mutate an immutable quote field.');
  }

  const nextQuoteNumber =
    typeof patch.quoteNumber === 'undefined' ? prev.quoteNumber : normaliseQuoteNumber(patch.quoteNumber) ?? prev.quoteNumber;
  if (!nextQuoteNumber) throw new Error('Quote number is required.');

  const nextCustomerTotalOverride =
    typeof patch.customerTotalOverride === 'undefined'
      ? prev.customerTotalOverride
      : patch.customerTotalOverride === null
        ? null
        : Number.isFinite(patch.customerTotalOverride) && patch.customerTotalOverride >= 0
          ? patch.customerTotalOverride
          : (() => {
              throw new Error('Customer total override must be a positive number.');
            })();

  const nextNotes = typeof patch.notes === 'undefined' ? prev.notes : typeof patch.notes === 'string' ? patch.notes : null;
  const updated: Quote = {
    ...prev,
    ...patch,
    quoteNumber: nextQuoteNumber,
    customerTotalOverride: nextCustomerTotalOverride,
    notes: nextNotes,
    updatedAt: nowIso(),
  };
  await apiJson<{ quote: Quote }>(`/api/staff/v1/quotes/${encodeURIComponent(quoteId)}`, { method: 'PUT', body: JSON.stringify({ quote: updated }) });
  upsertQuoteCache(updated);
  return updated;
}

export async function deleteQuote(quoteId: string): Promise<void> {
  const q = await getQuote(quoteId);
  if (!q) throw new Error('Quote not found');
  await apiJson(`/api/staff/v1/quotes/${encodeURIComponent(quoteId)}`, { method: 'DELETE' });
  writeAllCache(readAllCache().filter((x) => x.id !== quoteId));
  await addProjectActivity(q.projectId, {
    type: 'quote_deleted',
    message: `Quote v${q.version} deleted`,
    meta: { quoteId: q.id, version: q.version, status: q.status },
  });
}

export async function duplicateQuoteAsRevision(quoteId: string): Promise<Quote> {
  const prev = await getQuote(quoteId);
  if (!prev) throw new Error('Quote not found');

  const rootQuoteId = prev.rootQuoteId || prev.id;
  const series = readAllCache().filter((q) => (q.rootQuoteId || q.id) === rootQuoteId);
  const maxVersion = series.reduce((max, q) => (typeof q.version === 'number' ? Math.max(max, q.version) : max), 0);

  const now = nowIso();
  const next: Quote = {
    ...prev,
    id: newId('quo'),
    rootQuoteId,
    version: maxVersion + 1,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    sentAt: undefined,
    paidAt: undefined,
  };

  await apiJson<{ quote: Quote }>('/api/staff/v1/quotes', { method: 'POST', body: JSON.stringify({ quote: next }) });
  upsertQuoteCache(next);
  await addProjectActivity(prev.projectId, {
    type: 'quote_duplicated',
    message: `${next.quoteNumber ?? 'Quote'} duplicated to v${next.version}`,
    meta: { quoteId: next.id, version: next.version, quoteNumber: next.quoteNumber, status: next.status },
  });
  return next;
}

export async function markQuoteSent(quoteId: string): Promise<Quote> {
  const prev = await getQuote(quoteId);
  if (!prev) throw new Error('Quote not found');
  if (prev.status !== 'draft') return prev;

  const updated: Quote = { ...prev, status: 'sent', sentAt: nowIso(), updatedAt: nowIso() };
  await apiJson<{ quote: Quote }>(`/api/staff/v1/quotes/${encodeURIComponent(quoteId)}`, { method: 'PUT', body: JSON.stringify({ quote: updated }) });
  upsertQuoteCache(updated);
  await addProjectActivity(updated.projectId, {
    type: 'quote_sent',
    message: `${updated.quoteNumber ?? 'Quote'} marked sent`,
    meta: { quoteId: updated.id, version: updated.version, quoteNumber: updated.quoteNumber, status: updated.status },
  });
  return updated;
}

export async function markQuotePaid(quoteId: string): Promise<Quote> {
  const prev = await getQuote(quoteId);
  if (!prev) throw new Error('Quote not found');
  if (prev.status === 'paid') return prev;
  if (prev.status !== 'sent') throw new Error('Only sent quotes can be marked paid.');

  const updated: Quote = { ...prev, status: 'paid', paidAt: nowIso(), updatedAt: nowIso() };
  await apiJson<{ quote: Quote }>(`/api/staff/v1/quotes/${encodeURIComponent(quoteId)}`, { method: 'PUT', body: JSON.stringify({ quote: updated }) });
  upsertQuoteCache(updated);
  await addProjectActivity(updated.projectId, {
    type: 'quote_paid',
    message: `${updated.quoteNumber ?? 'Quote'} marked paid`,
    meta: { quoteId: updated.id, version: updated.version, quoteNumber: updated.quoteNumber, status: updated.status },
  });
  return updated;
}

export function quoteIsLocked(quote: Quote): boolean {
  return quote.status === 'sent' || quote.status === 'paid';
}

export function quoteNextAction(quote: Quote): { label: string; nextStatus: QuoteStatus } | null {
  if (quote.status === 'draft') return { label: 'Mark Sent', nextStatus: 'sent' };
  if (quote.status === 'sent') return { label: 'Mark Paid', nextStatus: 'paid' };
  return null;
}
