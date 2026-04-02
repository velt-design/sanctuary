'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import legacy from '@/app/staff/projects/projects.module.css';
import styles from './QuotesTab.module.css';
import QuotePdfInlinePreview from './QuotePdfInlinePreview';
import type { EstimateDetail, EstimateMeta } from '@/lib/estimates/types';
import type { QuoteLineItem, QuoteStatus, QuoteVersion, QuoteVersionDetail } from '@/lib/quotes/types';
import {
  createQuoteInvoice,
  deleteDraftQuoteVersion,
  markQuoteAccepted,
  markQuoteDeclined,
  previewQuoteEmail,
  previewQuotePdf,
  quotePdfUrl,
  refreshDraftQuoteFromEstimate,
  resendQuote,
  reviseQuote,
  sendQuote,
} from '@/lib/quotes/quotesRepo';
import { quoteVersionDetailQueryOptions, quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import { estimateDetailQueryOptions, estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { qk } from '@/lib/queries/keys';
import { generatedJobPacksByProjectQueryOptions } from '@/lib/queries/jobPacks';
import { invalidateProjectReadCaches } from '@/lib/queries/projectCache';
import { generateJobPack } from '@/lib/repo/jobPacksRepo';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { useAliasedEntitySyncState } from '@/lib/localFirst/useEntitySyncState';
import { useResolvedLocalFirstId } from '@/lib/localFirst/useResolvedLocalFirstId';
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
  applyDraftPatchToQuoteDetail,
  buildOptimisticQuoteDetail,
  buildQuoteEntityKey,
  createLocalQuoteId,
  isLocalQuoteId,
  type PortalQuoteCreateMutationPayload,
  type PortalQuoteUpdateMutationPayload,
  upsertQuoteDetailCache,
} from '@/lib/localFirst/portalEntities';
import { enqueueAndProcessLocalFirstMutation } from '@/lib/localFirst/queue';
import { getAliasedLocalFirstEntitySyncState, writeLocalFirstWorkingCopy } from '@/lib/localFirst/store';

function formatMoneyFromCents(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `$${(value / 100).toFixed(2)}`;
}

function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString();
}

function parseDateLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parts = value.split('-').map((v) => Number(v));
  if (parts.length === 3 && parts.every((p) => Number.isFinite(p))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d;
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiry = parseDateLocal(expiresAt);
  if (!expiry) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return today > expiry;
}

function statusLabel(status: QuoteStatus): string {
  switch (status) {
    case 'SENT':
      return 'SENT';
    case 'ACCEPTED':
      return 'ACCEPTED';
    case 'DECLINED':
      return 'DECLINED';
    default:
      return 'DRAFT';
  }
}

function statusClass(status: QuoteStatus): string {
  switch (status) {
    case 'SENT':
      return styles.statusSent;
    case 'ACCEPTED':
      return styles.statusAccepted;
    case 'DECLINED':
      return styles.statusDeclined;
    default:
      return styles.statusDraft;
  }
}

function sanitizeMoneyInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  let next = '';
  let dotSeen = false;
  let decimalCount = 0;
  for (const ch of cleaned) {
    if (ch === '.') {
      if (dotSeen) continue;
      dotSeen = true;
      next += '.';
      continue;
    }
    if (!dotSeen) {
      next += ch;
      continue;
    }
    if (decimalCount >= 2) continue;
    decimalCount += 1;
    next += ch;
  }
  return next;
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function validateQuotePreviewPdf(contentType: string | null, bytes: Uint8Array): string | null {
  if (!bytes.byteLength) return 'Failed to load quote preview: empty PDF response.';
  if (!hasPdfSignature(bytes)) {
    const typeLabel = contentType?.trim() || 'unknown content type';
    return `Failed to load quote preview: expected PDF bytes, received ${typeLabel}.`;
  }
  return null;
}

function formatMoneyInputValue(valueCents: number): string {
  if (!Number.isFinite(valueCents)) return '0';
  const value = valueCents / 100;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function parseMoneyInput(value: string): number {
  const cleaned = sanitizeMoneyInput(value);
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function parseQtyInput(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizePercentInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  let next = '';
  let dotSeen = false;
  let decimalCount = 0;
  for (const ch of cleaned) {
    if (ch === '.') {
      if (dotSeen) continue;
      dotSeen = true;
      next += '.';
      continue;
    }
    if (!dotSeen) {
      next += ch;
      continue;
    }
    if (decimalCount >= 2) continue;
    decimalCount += 1;
    next += ch;
  }
  return next;
}

function parsePercentInput(value: string): number {
  const raw = Number.parseFloat(normalizePercentInput(value));
  if (!Number.isFinite(raw)) return 50;
  return Math.max(0, Math.min(100, Math.round(raw * 100) / 100));
}

function formatPercentInput(value: number): string {
  if (!Number.isFinite(value)) return '50';
  return Math.max(0, Math.min(100, value)).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function dateInputDaysFromToday(days: number): string {
  const next = new Date();
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + days);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, '0');
  const day = String(next.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeLineTotal(item: QuoteLineItem): number {
  const qty = Number.isFinite(item.qty) ? item.qty : 0;
  const unit = Number.isFinite(item.unitPriceIncGstCents) ? item.unitPriceIncGstCents : 0;
  return Math.round(qty * unit);
}

function defaultPersonalNote(): string {
  return '';
}

function defaultSubject(quoteRef: string): string {
  return `Your quote ${quoteRef}`;
}

const MAX_DESIGN_PDF_BYTES = 20 * 1024 * 1024;
const SEND_PREVIEW_DEBOUNCE_MS = 250;
const QUOTE_PREVIEW_DEBOUNCE_MS = 200;

type SendEditorMode = 'compose' | 'preview';

function validateDesignPdf(file: File): string | null {
  if (file.size <= 0) return 'Design PDF is empty.';
  if (file.size > MAX_DESIGN_PDF_BYTES) return 'Design PDF must be 20MB or smaller.';
  const mime = file.type.trim().toLowerCase();
  if (mime === 'application/pdf') return null;
  if (file.name.trim().toLowerCase().endsWith('.pdf')) return null;
  return 'Design document must be a PDF.';
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = await res.json();
      const message = typeof body?.error === 'string' ? body.error.trim() : '';
      if (message) return message;
    } catch {
      // Ignore parse errors and fall through to text handling.
    }
  }
  try {
    const text = (await res.text()).trim();
    if (text) return text;
  } catch {
    // Ignore read errors and use fallback.
  }
  return fallback;
}

function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function quoteDraftFilename(detail: QuoteVersionDetail): string {
  const rawBase = `${detail.quoteRef || 'quote'}-v${detail.versionNumber}-draft`;
  const safeBase = rawBase.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${safeBase || 'quote-draft'}.pdf`;
}

export default function QuotesTab({
  projectId,
  selectedQuoteId,
  onSelectedQuoteChange,
}: {
  projectId: string;
  selectedQuoteId?: string | null;
  onSelectedQuoteChange?: (quoteId: string | null) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  const selectedFromUrl = useMemo(() => {
    const raw = searchParams.get('quoteId') ?? '';
    const trimmed = raw.trim();
    if (!trimmed || isLocalQuoteId(trimmed)) return null;
    return trimmed;
  }, [searchParams]);
  const createFromEstimateId = useMemo(() => {
    const raw = searchParams.get('createFromEstimateId') ?? '';
    return raw.trim() || null;
  }, [searchParams]);
  const pagePreviewFromUrl = useMemo(() => searchParams.get('quotePreview') === '1', [searchParams]);
  const autoCreateRef = useRef<string | null>(null);
  const didAutoSelectInitialQuoteRef = useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(selectedQuoteId ?? selectedFromUrl);
  const resolvedSelectedId = useResolvedLocalFirstId(selectedId);

  const quotesQuery = useQuery(quoteVersionsByProjectQueryOptions(hostKey, projectId));
  const estimatesQuery = useQuery(estimateMetasByProjectQueryOptions(hostKey, projectId));
  const jobPacksQuery = useQuery(generatedJobPacksByProjectQueryOptions(hostKey, projectId));

  const quotes = quotesQuery.data ?? [];
  const quotesLoading = quotesQuery.isPending;
  const quotesError =
    quotesQuery.error instanceof Error ? quotesQuery.error.message : quotesQuery.error ? String(quotesQuery.error) : null;

  const estimates = estimatesQuery.data ?? [];
  const estimatesLoading = estimatesQuery.isPending;
  const generatedJobPacks = jobPacksQuery.data ?? [];

  const quoteDetailQuery = useQuery({
    ...quoteVersionDetailQueryOptions(hostKey, selectedId || ''),
    enabled: Boolean(selectedId),
  });
  const detailLoading = Boolean(selectedId) && quoteDetailQuery.isPending;
  const detail = quoteDetailQuery.data ?? null;
  const detailSyncState = useAliasedEntitySyncState(detail?.id, buildQuoteEntityKey, 'quote:detail:__quote-none__');
  const draftSyncPending = Boolean(detail && detail.status === 'DRAFT' && detailSyncState.pendingCount > 0);

  const [createOpen, setCreateOpen] = useState(false);
  const [createEstimateId, setCreateEstimateId] = useState('');

  const [sendOpen, setSendOpen] = useState(false);
  const [sendMode, setSendMode] = useState<'send' | 'resend'>('send');
  const [sendTo, setSendTo] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendPersonalNote, setSendPersonalNote] = useState('');
  const [sendDesignPdf, setSendDesignPdf] = useState<File | null>(null);
  const [sendEditorMode, setSendEditorMode] = useState<SendEditorMode>('compose');
  const [sendPreviewHtml, setSendPreviewHtml] = useState('');
  const [sendPreviewLoading, setSendPreviewLoading] = useState(false);
  const [sendPreviewError, setSendPreviewError] = useState<string | null>(null);
  const [sendPreviewHeight, setSendPreviewHeight] = useState(640);
  const sendPreviewRequestRef = useRef(0);
  const sendPreviewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceDepositPercent, setInvoiceDepositPercent] = useState('50');
  const [invoiceDueDate, setInvoiceDueDate] = useState(dateInputDaysFromToday(7));
  const [invoiceReference, setInvoiceReference] = useState('');
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [quotePdfPreviewData, setQuotePdfPreviewData] = useState<Uint8Array | null>(null);
  const quotePdfPreviewCacheRef = useRef(new Map<string, Uint8Array>());
  const [quotePdfPreviewLoading, setQuotePdfPreviewLoading] = useState(false);
  const [quotePdfPreviewError, setQuotePdfPreviewError] = useState<string | null>(null);

  const [expiredPromptOpen, setExpiredPromptOpen] = useState(false);
  const [pendingResendId, setPendingResendId] = useState<string | null>(null);
  const [jobPackBusy, setJobPackBusy] = useState(false);
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [draftItems, setDraftItems] = useState<QuoteLineItem[]>([]);
  const [unitInputDrafts, setUnitInputDrafts] = useState<Record<string, string>>({});
  const [activeUnitInputId, setActiveUnitInputId] = useState<string | null>(null);
  const [draftReference, setDraftReference] = useState('');
  const [draftIntro, setDraftIntro] = useState('');
  const [draftTerms, setDraftTerms] = useState('');
  const [draftDepositPercent, setDraftDepositPercent] = useState('50');
  const [draftExpiry, setDraftExpiry] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [downloadingDraftPdf, setDownloadingDraftPdf] = useState(false);
  const prefetchedQuoteDetailsRef = useRef(new Set<string>());

  const resetDraftFormFromDetail = useCallback((quoteDetail: QuoteVersionDetail) => {
    setDraftItems(quoteDetail.lineItems);
    setUnitInputDrafts({});
    setActiveUnitInputId(null);
    setDraftReference(quoteDetail.reference ?? '');
    setDraftIntro(quoteDetail.introText ?? '');
    setDraftTerms(quoteDetail.termsText ?? '');
    setDraftDepositPercent(formatPercentInput(quoteDetail.depositPercent));
    setDraftExpiry(quoteDetail.expiresAt ?? '');
  }, []);

  const refreshQuotes = useCallback(async (opts?: { includeEstimates?: boolean }) => {
    await invalidateProjectReadCaches(queryClient, hostKey, projectId, {
      includeQuotes: true,
      includeEstimates: opts?.includeEstimates,
    });
  }, [hostKey, projectId, queryClient]);

  const prefetchQuoteDetail = useCallback((quoteVersionId: string) => {
    const token = `${hostKey}:${quoteVersionId}`;
    if (prefetchedQuoteDetailsRef.current.has(token)) return;
    prefetchedQuoteDetailsRef.current.add(token);
    void queryClient.prefetchQuery(quoteVersionDetailQueryOptions(hostKey, quoteVersionId));
  }, [hostKey, queryClient]);

  const detailErrorNotifiedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) {
      detailErrorNotifiedRef.current = null;
      return;
    }
    if (!quoteDetailQuery.error) {
      detailErrorNotifiedRef.current = null;
      return;
    }
    const msg = quoteDetailQuery.error instanceof Error ? quoteDetailQuery.error.message : String(quoteDetailQuery.error);
    if (!msg) return;
    if (detailErrorNotifiedRef.current === msg) return;
    detailErrorNotifiedRef.current = msg;
    toast.error(msg);
  }, [quoteDetailQuery.error, selectedId, toast]);

  useEffect(() => {
    let nextSelectedId: string | null | undefined;

    if (selectedFromUrl) {
      didAutoSelectInitialQuoteRef.current = true;
      nextSelectedId = selectedFromUrl;
    } else if (!quotes.length) {
      nextSelectedId = quotesLoading ? undefined : null;
    } else if (selectedId && quotes.some((quote) => quote.id === selectedId)) {
      nextSelectedId = undefined;
    } else if (!didAutoSelectInitialQuoteRef.current) {
      didAutoSelectInitialQuoteRef.current = true;
      nextSelectedId = quotes[0]?.id ?? null;
    } else {
      nextSelectedId = null;
    }

    if (nextSelectedId === undefined || nextSelectedId === selectedId) return;
    setSelectedId(nextSelectedId);
    onSelectedQuoteChange?.(nextSelectedId);
  }, [onSelectedQuoteChange, quotes, quotesLoading, selectedFromUrl, selectedId]);

  useEffect(() => {
    if (!detail) return;
    resetDraftFormFromDetail(detail);
  }, [detail?.id, resetDraftFormFromDetail]);

  const getLiveUnitPriceIncGstCents = useCallback(
    (item: QuoteLineItem): number => {
      const raw = unitInputDrafts[item.id];
      if (typeof raw !== 'string') return item.unitPriceIncGstCents;
      return parseMoneyInput(raw);
    },
    [unitInputDrafts],
  );

  const effectiveDraftItems = useMemo(
    () =>
      draftItems.map((item) => {
        const nextUnitPrice = getLiveUnitPriceIncGstCents(item);
        if (nextUnitPrice === item.unitPriceIncGstCents) return item;
        return { ...item, unitPriceIncGstCents: nextUnitPrice };
      }),
    [draftItems, getLiveUnitPriceIncGstCents],
  );

  const commitUnitPriceDraft = useCallback((itemId: string, rawValue: string) => {
    const nextCents = parseMoneyInput(rawValue);
    setDraftItems((prev) => {
      const idx = prev.findIndex((entry) => entry.id === itemId);
      if (idx === -1) return prev;
      if (prev[idx].unitPriceIncGstCents === nextCents) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], unitPriceIncGstCents: nextCents };
      return next;
    });
    setUnitInputDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, itemId)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const updateParams = useCallback((next: { quoteId?: string | null; createFromEstimateId?: string | null }) => {
    const qs = new URLSearchParams(searchParams.toString());
    if (Object.prototype.hasOwnProperty.call(next, 'quoteId')) {
      if (!next.quoteId) {
        qs.delete('quoteId');
        qs.delete('quotePreview');
      }
      else qs.set('quoteId', next.quoteId);
    }
    if (Object.prototype.hasOwnProperty.call(next, 'createFromEstimateId')) {
      if (!next.createFromEstimateId) qs.delete('createFromEstimateId');
      else qs.set('createFromEstimateId', next.createFromEstimateId);
    }
    const query = qs.toString();
    router.replace(query ? `?${query}` : '?');
  }, [router, searchParams]);

  const selectQuote = useCallback((quoteId: string | null, opts?: { createFromEstimateId?: string | null }) => {
    if (quoteId) {
      didAutoSelectInitialQuoteRef.current = true;
    }
    setSelectedId(quoteId);
    onSelectedQuoteChange?.(quoteId);
    updateParams({
      quoteId: quoteId && !isLocalQuoteId(quoteId) ? quoteId : null,
      createFromEstimateId: opts?.createFromEstimateId,
    });
  }, [onSelectedQuoteChange, updateParams]);

  useEffect(() => {
    if (!selectedId || !resolvedSelectedId || resolvedSelectedId === selectedId) return;
    selectQuote(resolvedSelectedId, { createFromEstimateId: null });
  }, [resolvedSelectedId, selectQuote, selectedId]);

  const latestEstimate = useMemo(() => {
    if (!estimates.length) return null;
    return [...estimates].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }, [estimates]);
  const preferredQuoteSourceDesign = useMemo(() => {
    if (!estimates.length) return null;
      return estimates.find((estimate) => estimate.isActiveDraft) ?? latestEstimate ?? estimates[0] ?? null;
  }, [estimates, latestEstimate]);
  const currentSourceEstimate = useMemo(
    () => (detail ? estimates.find((estimate) => estimate.id === detail.sourceEstimateVersionId) ?? null : null),
    [detail, estimates],
  );
  const refreshEstimateTarget = useMemo(() => {
    if (!detail) return preferredQuoteSourceDesign ?? currentSourceEstimate;
    return preferredQuoteSourceDesign ?? currentSourceEstimate;
  }, [currentSourceEstimate, detail, preferredQuoteSourceDesign]);
  const refreshUsesLatestDesign = Boolean(
    detail &&
      refreshEstimateTarget &&
      refreshEstimateTarget.id !== detail.sourceEstimateVersionId,
  );

  const detailTotals = useMemo(() => {
    if (!detail) return null;
    if (detail.status !== 'DRAFT') return detail.totals;
    const totalInc = effectiveDraftItems.reduce((sum, item) => sum + computeLineTotal(item), 0);
    const totalEx = Math.round(totalInc / 1.15);
    const gst = totalInc - totalEx;
    return { totalIncGstCents: totalInc, totalExGstCents: totalEx, gstCents: gst };
  }, [detail, effectiveDraftItems]);

  const draftDirty = useMemo(() => {
    if (!detail) return false;
    if (detail.status !== 'DRAFT') return false;
    const lineMatch = detail.lineItems.length === effectiveDraftItems.length && detail.lineItems.every((item, idx) => {
      const next = effectiveDraftItems[idx];
      return (
        item.description === next.description &&
        item.qty === next.qty &&
        item.unitPriceIncGstCents === next.unitPriceIncGstCents
      );
    });
    if (!lineMatch) return true;
    if ((detail.reference ?? '') !== draftReference) return true;
    if ((detail.introText ?? '') !== draftIntro) return true;
    if ((detail.termsText ?? '') !== draftTerms) return true;
    if (formatPercentInput(detail.depositPercent) !== formatPercentInput(parsePercentInput(draftDepositPercent))) return true;
    if ((detail.expiresAt ?? '') !== draftExpiry) return true;
    return false;
  }, [detail, effectiveDraftItems, draftReference, draftIntro, draftTerms, draftDepositPercent, draftExpiry]);

  const previewDetail = useMemo(() => {
    if (!detail) return null;
    if (detail.status !== 'DRAFT') return detail;
    return applyDraftPatchToQuoteDetail(detail, {
      reference: draftReference,
      introText: draftIntro,
      termsText: draftTerms,
      depositPercent: parsePercentInput(draftDepositPercent),
      expiresAt: draftExpiry || null,
      lineItems: effectiveDraftItems.map((item) => ({
        description: item.description,
        qty: item.qty,
        unitPriceIncGstCents: item.unitPriceIncGstCents,
      })),
    });
  }, [detail, draftDepositPercent, draftExpiry, draftIntro, draftReference, draftTerms, effectiveDraftItems]);

  const quotePdfPreviewSrc = useMemo(
    () => (previewDetail && previewDetail.status !== 'DRAFT' ? quotePdfUrl(previewDetail.id, { inline: true }) : ''),
    [previewDetail],
  );

  const quotePdfPreviewKey = useMemo(() => {
    if (!previewDetail) return '';
    if (typeof previewDetail.renderHash === 'string' && previewDetail.renderHash.trim()) return previewDetail.renderHash.trim();
    const lineSignature = previewDetail.lineItems
      .map((item) => `${item.description}:${item.qty}:${item.unitPriceIncGstCents}`)
      .join('|');
    return [
      previewDetail.id,
      previewDetail.status,
      previewDetail.sentAt ?? '',
      previewDetail.expiresAt ?? '',
      previewDetail.reference ?? '',
      previewDetail.depositPercent,
      previewDetail.introText ?? '',
      previewDetail.termsText ?? '',
      previewDetail.totals.totalIncGstCents,
      lineSignature,
    ].join('::');
  }, [previewDetail]);

  useEffect(() => {
    return () => {
      quotePdfPreviewCacheRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!pagePreviewFromUrl || !previewDetail) {
      setQuotePdfPreviewLoading(false);
      setQuotePdfPreviewError(null);
      setQuotePdfPreviewData(null);
      return;
    }

    const ac = new AbortController();
    setQuotePdfPreviewLoading(true);
    setQuotePdfPreviewError(null);

    const cachedData = quotePdfPreviewCacheRef.current.get(quotePdfPreviewKey);
    if (cachedData) {
      setQuotePdfPreviewLoading(false);
      setQuotePdfPreviewError(null);
      setQuotePdfPreviewData(cachedData);
      return () => {
        ac.abort();
      };
    }

    const run = async () => {
      try {
        let contentType: string | null = 'application/pdf';
        let bytes: Uint8Array;

        if (previewDetail.status === 'DRAFT') {
          bytes = await previewQuotePdf(previewDetail, { signal: ac.signal });
        } else {
          const res = await fetch(quotePdfPreviewSrc, {
            method: 'GET',
            credentials: 'same-origin',
            signal: ac.signal,
          });
          if (!res.ok) {
            const msg = await readErrorMessage(res, `Failed to load quote preview (${res.status})`);
            throw new Error(msg);
          }
          contentType = res.headers.get('content-type');
          bytes = new Uint8Array(await res.arrayBuffer());
        }
        if (ac.signal.aborted) return;
        const validationError = validateQuotePreviewPdf(contentType, bytes);
        if (validationError) {
          throw new Error(validationError);
        }
        if (contentType && !contentType.toLowerCase().includes('application/pdf')) {
          console.warn('[quote_preview] unexpected PDF content type', { contentType, byteLength: bytes.byteLength });
        }
        if (quotePdfPreviewKey) {
          quotePdfPreviewCacheRef.current.set(quotePdfPreviewKey, bytes);
        }
        setQuotePdfPreviewData(bytes);
      } catch (err) {
        if (ac.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load quote preview';
        console.error('[quote_preview] failed to fetch preview PDF', { error: err, quoteVersionId: previewDetail.id });
        setQuotePdfPreviewError(msg);
        setQuotePdfPreviewData(null);
      } finally {
        if (!ac.signal.aborted) {
          setQuotePdfPreviewLoading(false);
        }
      }
    };

    const timeout = window.setTimeout(() => {
      void run();
    }, previewDetail.status === 'DRAFT' ? QUOTE_PREVIEW_DEBOUNCE_MS : 0);

    return () => {
      ac.abort();
      window.clearTimeout(timeout);
    };
  }, [pagePreviewFromUrl, previewDetail, quotePdfPreviewKey, quotePdfPreviewSrc]);

  const openCreateModal = () => {
    const defaultId = preferredQuoteSourceDesign?.id ?? '';
    if (!defaultId) {
      toast.error('Create a design first.');
      return;
    }
    setCreateEstimateId(defaultId);
    setCreateOpen(true);
  };

  const createDraftQuoteFromEstimate = useCallback(async (estimateId: string, opts?: { closeModal?: boolean }) => {
    if (!estimateId) return;
    try {
      const estimateDetail =
        queryClient.getQueryData<EstimateDetail>(qk.estimates.detail(hostKey, estimateId)) ??
        (await queryClient.fetchQuery(estimateDetailQueryOptions(hostKey, estimateId)));
      const localQuoteId = createLocalQuoteId();
      const optimisticDetail = buildOptimisticQuoteDetail({
        quoteVersionId: localQuoteId,
        projectId,
        estimateDetail,
        existingQuotes: quotes,
      });

      upsertQuoteDetailCache(queryClient, hostKey, projectId, optimisticDetail, { prepend: true });
      await writeLocalFirstWorkingCopy({
        entityKey: buildQuoteEntityKey(localQuoteId),
        data: optimisticDetail,
      });

      const mutationPayload: PortalQuoteCreateMutationPayload = {
        localQuoteId,
        projectId,
        estimateId,
      };
      await enqueueAndProcessLocalFirstMutation({
        entityKey: buildQuoteEntityKey(localQuoteId),
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.quoteCreateFromEstimate,
        payload: mutationPayload,
      });

      if (opts?.closeModal) setCreateOpen(false);
      selectQuote(localQuoteId, { createFromEstimateId: null });
      toast.success('Draft quote created locally. Syncing in the background.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create quote';
      toast.error(msg);
    }
  }, [hostKey, projectId, queryClient, selectQuote, toast]);

  const handleCreateQuote = async () => {
    if (!createEstimateId) return;
    await createDraftQuoteFromEstimate(createEstimateId, { closeModal: true });
  };

  useEffect(() => {
    if (!createFromEstimateId) {
      autoCreateRef.current = null;
      return;
    }
    if (estimatesLoading) return;
    const token = `${projectId}:${createFromEstimateId}`;
    if (autoCreateRef.current === token) return;
    autoCreateRef.current = token;

    if (!estimates.some((estimate) => estimate.id === createFromEstimateId)) {
      toast.error('Design not found for quote creation.');
      updateParams({ createFromEstimateId: null });
      return;
    }

    void createDraftQuoteFromEstimate(createFromEstimateId).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Failed to create quote';
      toast.error(msg);
      updateParams({ createFromEstimateId: null });
    });
  }, [createDraftQuoteFromEstimate, createFromEstimateId, estimates, estimatesLoading, projectId, toast, updateParams]);

  const openSendModal = useCallback((mode: 'send' | 'resend', editorMode: SendEditorMode = 'compose') => {
    if (!detail) return;
    if (mode === 'send' && draftDirty) {
      toast.error('Save the draft before sending.');
      return;
    }
    if (mode === 'send' && draftSyncPending) {
      toast.error('Wait for the draft to finish syncing before sending.');
      return;
    }
    const to = detail.contact?.email ?? '';
    setSendMode(mode);
    setSendTo(to);
    setSendSubject(defaultSubject(detail.quoteRef));
    setSendPersonalNote(defaultPersonalNote());
    setSendDesignPdf(null);
    setSendEditorMode(editorMode);
    setSendPreviewHtml('');
    setSendPreviewError(null);
    setSendPreviewLoading(false);
    setSendPreviewHeight(640);
    sendPreviewRequestRef.current += 1;
    setSendError(null);
    setSendOpen(true);
  }, [detail, draftDirty, draftSyncPending, toast]);

  const closeSendModal = useCallback(() => {
    setSendDesignPdf(null);
    setSendEditorMode('compose');
    setSendPreviewHtml('');
    setSendPreviewError(null);
    setSendPreviewLoading(false);
    setSendPreviewHeight(640);
    setSendError(null);
    setSendOpen(false);
    sendPreviewRequestRef.current += 1;
  }, []);

  const sizeSendPreviewIframe = useCallback(() => {
    const frame = sendPreviewFrameRef.current;
    if (!frame) return;
    const doc = frame.contentDocument;
    if (!doc) return;
    const next = Math.max(
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
      220,
    );
    setSendPreviewHeight((prev) => (Math.abs(prev - next) > 8 ? next : prev));
  }, []);

  useEffect(() => {
    const previewQuoteId = detail?.id ?? '';
    if (!sendOpen || sendEditorMode !== 'preview' || !previewQuoteId) return;

    const requestId = sendPreviewRequestRef.current + 1;
    sendPreviewRequestRef.current = requestId;
    const ac = new AbortController();
    const to = sendTo.split(',').map((entry) => entry.trim()).filter(Boolean);

    const run = async () => {
      setSendPreviewLoading(true);
      setSendPreviewError(null);
      try {
        const rendered = await previewQuoteEmail(
          previewQuoteId,
          {
            mode: sendMode,
            to,
            subject: sendSubject,
            personalNote: sendPersonalNote,
          },
          { signal: ac.signal },
        );
        if (ac.signal.aborted || requestId !== sendPreviewRequestRef.current) return;
        setSendPreviewHtml(rendered.html);
        requestAnimationFrame(() => sizeSendPreviewIframe());
      } catch (err) {
        if (ac.signal.aborted || requestId !== sendPreviewRequestRef.current) return;
        const msg = err instanceof Error ? err.message : 'Failed to load preview';
        setSendPreviewHtml('');
        setSendPreviewError(msg);
      } finally {
        if (!ac.signal.aborted && requestId === sendPreviewRequestRef.current) {
          setSendPreviewLoading(false);
        }
      }
    };

    const timeout = window.setTimeout(() => {
      void run();
    }, SEND_PREVIEW_DEBOUNCE_MS);

    return () => {
      ac.abort();
      window.clearTimeout(timeout);
    };
  }, [detail?.id, sendEditorMode, sendMode, sendOpen, sendPersonalNote, sendSubject, sendTo, sizeSendPreviewIframe]);

  const handleSend = async () => {
    if (!detail || sendBusy) return;
    if (sendMode === 'send' && draftDirty) {
      toast.error('Save the draft before sending.');
      return;
    }
    if (sendMode === 'send' && draftSyncPending) {
      toast.error('Wait for the draft to finish syncing before sending.');
      return;
    }
    const to = sendTo.split(',').map((v) => v.trim()).filter(Boolean);
    if (!to.length) {
      toast.error('Recipient email is required.');
      return;
    }
    if (!sendSubject.trim()) {
      toast.error('Subject is required.');
      return;
    }
    if (sendDesignPdf) {
      const designPdfError = validateDesignPdf(sendDesignPdf);
      if (designPdfError) {
        setSendError(designPdfError);
        toast.error(designPdfError);
        return;
      }
    }
    setSendBusy(true);
    setSendError(null);
    try {
      const updated = sendMode === 'send'
        ? await sendQuote(detail.id, { to, subject: sendSubject, personalNote: sendPersonalNote, designPdf: sendDesignPdf })
        : await resendQuote(detail.id, { to, subject: sendSubject, personalNote: sendPersonalNote, designPdf: sendDesignPdf });
      queryClient.setQueryData(qk.quotes.detail(hostKey, updated.id), updated);
      setDraftItems(updated.lineItems);
      setUnitInputDrafts({});
      setActiveUnitInputId(null);
      closeSendModal();
      await refreshQuotes();
      toast.success(sendMode === 'send' ? 'Quote sent.' : 'Quote resent.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send quote';
      setSendError(msg);
      toast.error(msg);
    } finally {
      setSendBusy(false);
    }
  };

  const handleRevise = async () => {
    if (!detail) return;
    try {
      const revised = await reviseQuote(detail.id);
      queryClient.setQueryData(qk.quotes.detail(hostKey, revised.id), revised);
      await refreshQuotes({ includeEstimates: true });
      selectQuote(revised.id);
      toast.success('Draft revision created.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revise quote';
      toast.error(msg);
    }
  };

  const handleResendClick = () => {
    if (!detail) return;
    if (isExpired(detail.expiresAt)) {
      setPendingResendId(detail.id);
      setExpiredPromptOpen(true);
      return;
    }
    openSendModal('resend');
  };

  const handleExpiredResend = async (mode: 'resend' | 'revise') => {
    setExpiredPromptOpen(false);
    if (!detail || !pendingResendId) return;
    if (mode === 'revise') {
      await handleRevise();
      return;
    }
    openSendModal('resend');
  };

  const handleSaveDraft = async () => {
    if (!detail) return;
    setSavingDraft(true);
    try {
      const patch = {
        reference: draftReference,
        introText: draftIntro,
        termsText: draftTerms,
        depositPercent: parsePercentInput(draftDepositPercent),
        expiresAt: draftExpiry || null,
        lineItems: effectiveDraftItems.map((item) => ({
          description: item.description,
          qty: item.qty,
          unitPriceIncGstCents: item.unitPriceIncGstCents,
        })),
      };
      const updated = applyDraftPatchToQuoteDetail(detail, patch);
      upsertQuoteDetailCache(queryClient, hostKey, projectId, updated);
      await writeLocalFirstWorkingCopy({
        entityKey: buildQuoteEntityKey(detail.id),
        data: updated,
      });

      const mutationPayload: PortalQuoteUpdateMutationPayload = {
        quoteVersionId: detail.id,
        patch,
      };
      await enqueueAndProcessLocalFirstMutation({
        entityKey: buildQuoteEntityKey(detail.id),
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.quoteUpdateDraft,
        payload: mutationPayload,
      });

      setDraftItems(updated.lineItems);
      setUnitInputDrafts({});
      setActiveUnitInputId(null);
      setDraftReference(updated.reference ?? '');
      setDraftIntro(updated.introText ?? '');
      setDraftTerms(updated.termsText ?? '');
      setDraftDepositPercent(formatPercentInput(updated.depositPercent));
      setDraftExpiry(updated.expiresAt ?? '');
      toast.success('Draft saved locally. Syncing in the background.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save draft';
      toast.error(msg);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDownloadDraftPdf = async () => {
    if (!detail || detail.status !== 'DRAFT' || !previewDetail || downloadingDraftPdf) return;
    setDownloadingDraftPdf(true);
    try {
      const cachedBytes = quotePdfPreviewCacheRef.current.get(quotePdfPreviewKey);
      const bytes = cachedBytes ?? (await previewQuotePdf(previewDetail));
      if (!cachedBytes && quotePdfPreviewKey) {
        quotePdfPreviewCacheRef.current.set(quotePdfPreviewKey, bytes);
      }
      downloadPdfBytes(bytes, quoteDraftFilename(previewDetail));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to download draft PDF';
      toast.error(msg);
    } finally {
      setDownloadingDraftPdf(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!detail) return;
    if (isLocalQuoteId(detail.id) || draftSyncPending) {
      toast.error('Wait for the draft to finish syncing before deleting.');
      return;
    }
    try {
      await deleteDraftQuoteVersion(detail.id);
      queryClient.removeQueries({ queryKey: qk.quotes.detail(hostKey, detail.id) });
      setDeleteConfirmOpen(false);
      selectQuote(null);
      await refreshQuotes();
      toast.success('Draft deleted.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete draft';
      toast.error(msg);
    }
  };

  const handleRefreshFromEstimate = async () => {
    if (!detail || detail.status !== 'DRAFT' || !refreshEstimateTarget || refreshBusy) return;
    if (isLocalQuoteId(detail.id) || draftSyncPending) {
      toast.error('Wait for the draft to finish syncing before refreshing from design.');
      return;
    }
    setRefreshBusy(true);
    try {
      const updated = await refreshDraftQuoteFromEstimate(detail.id, refreshEstimateTarget.id);
      upsertQuoteDetailCache(queryClient, hostKey, projectId, updated);
      resetDraftFormFromDetail(updated);
      setRefreshConfirmOpen(false);
      await refreshQuotes({ includeEstimates: true });
      toast.success(
        refreshUsesLatestDesign
          ? `Draft refreshed from ${refreshEstimateTarget.versionLabel}.`
          : 'Draft regenerated from the current design.',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh quote from design';
      toast.error(msg);
    } finally {
      setRefreshBusy(false);
    }
  };

  const openInvoiceModal = () => {
    if (!detail) return;
    setInvoiceDepositPercent(formatPercentInput(detail.depositPercent));
    setInvoiceDueDate(dateInputDaysFromToday(7));
    setInvoiceReference(`Deposit for Quote ${detail.quoteRef}${detail.project.name ? ` - ${detail.project.name}` : ''}`);
    setInvoiceError(null);
    setInvoiceOpen(true);
  };

  const closeInvoiceModal = () => {
    if (invoiceBusy) return;
    setInvoiceOpen(false);
    setInvoiceError(null);
  };

  const handleCreateInvoice = async (sendNow: boolean) => {
    if (!detail) return;
    setInvoiceBusy(true);
    setInvoiceError(null);
    try {
      const result = await createQuoteInvoice(detail.id, {
        depositPercent: parsePercentInput(invoiceDepositPercent),
        dueDate: invoiceDueDate,
        reference: invoiceReference,
        sendNow,
      });
      await queryClient.invalidateQueries({ queryKey: qk.invoices.byProject(hostKey, projectId) });
      setInvoiceOpen(false);
      if (result.sendError) {
        toast.error(
          `${result.created ? 'Invoice created' : 'Existing invoice found'}. ${result.invoice.invoiceRef} was not emailed. ${result.sendError}`,
        );
        return;
      }
      if (sendNow) {
        if (result.alreadySent) {
          toast.success(`Invoice ${result.invoice.invoiceRef} already existed and was already sent.`);
        } else {
          toast.success(`${result.created ? 'Invoice created' : 'Existing invoice reused'} and sent: ${result.invoice.invoiceRef}.`);
        }
        return;
      }
      toast.success(result.created ? `Invoice ${result.invoice.invoiceRef} created.` : `Invoice ${result.invoice.invoiceRef} already exists.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create invoice';
      setInvoiceError(msg);
      toast.error(msg);
    } finally {
      setInvoiceBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!detail) return;
    try {
      const result = await markQuoteAccepted(detail.id);
      const updated = result.quoteVersion;
      queryClient.setQueryData(qk.quotes.detail(hostKey, updated.id), updated);
      await Promise.allSettled([
        refreshQuotes(),
        queryClient.invalidateQueries({ queryKey: qk.invoices.byProject(hostKey, projectId) }),
      ]);
      if (result.invoice?.sent) {
        toast.success(`Quote accepted and invoice ${result.invoice.invoiceRef} sent.`);
      } else if (result.invoice) {
        toast.error(
          `Quote accepted. Invoice ${result.invoice.invoiceRef} was created but not emailed. ${result.invoice.sendError ?? 'Open the Invoices tab to send it manually.'}`,
        );
      } else {
        toast.success('Quote accepted.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to mark accepted';
      toast.error(msg);
    }
  };

  const handleDecline = async () => {
    if (!detail) return;
    try {
      const updated = await markQuoteDeclined(detail.id);
      queryClient.setQueryData(qk.quotes.detail(hostKey, updated.id), updated);
      await refreshQuotes();
      toast.success('Quote marked declined.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to mark declined';
      toast.error(msg);
    }
  };

  const handleGenerateJobPack = async () => {
    if (!detail || jobPackBusy) return;
    setJobPackBusy(true);
    try {
      const jobPack = await generateJobPack({ projectId, quoteVersionId: detail.id });
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: qk.jobPacks.list(hostKey, projectId) }),
        invalidateProjectReadCaches(queryClient, hostKey, projectId, {
          includeEstimates: true,
          includeQuotes: false,
        }),
      ]);
      toast.success('Job pack generated.');
      router.replace(
        `/staff/projects/${encodeURIComponent(projectId)}?tab=job-packs&estimateId=${encodeURIComponent(
          jobPack.estimateId,
        )}&sheet=materials`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate job pack';
      toast.error(msg);
    } finally {
      setJobPackBusy(false);
    }
  };

  const handleAddRow = () => {
    setDraftItems((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        description: '',
        qty: 1,
        unitPriceIncGstCents: 0,
        lineTotalIncGstCents: 0,
        sortOrder: prev.length,
      },
    ]);
  };

  const handleDeleteRow = (idx: number) => {
    const removedId = draftItems[idx]?.id;
    if (removedId) {
      setActiveUnitInputId((prev) => (prev === removedId ? null : prev));
      setUnitInputDrafts((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, removedId)) return prev;
        const next = { ...prev };
        delete next[removedId];
        return next;
      });
    }
    setDraftItems((prev) => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, sortOrder: i })));
  };

  const handleMoveRow = (idx: number, direction: -1 | 1) => {
    setDraftItems((prev) => {
      const next = prev.slice();
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next.map((entry, i) => ({ ...entry, sortOrder: i }));
    });
  };

  if (selectedId && detailLoading) {
    return <p className={legacy.note}>Loading quote…</p>;
  }

  if (selectedId && detail) {
    const expired = isExpired(detail.expiresAt);
    const hasNewerEstimate = refreshUsesLatestDesign;
    const generatedJobPack = generatedJobPacks.find((jobPack) => jobPack.quoteVersionId === detail.id) ?? null;
    const canGenerateJobPack =
      (detail.status === 'SENT' || detail.status === 'ACCEPTED' || detail.status === 'DECLINED') && !generatedJobPack;
    const openJobPackHref = generatedJobPack
      ? `/staff/projects/${encodeURIComponent(projectId)}?tab=job-packs&estimateId=${encodeURIComponent(
          generatedJobPack.estimateId,
        )}&sheet=materials`
      : null;

    return (
      <div className={styles.wrapper}>
        <div className={styles.detailHeader}>
          <button type="button" className={styles.backButton} onClick={() => selectQuote(null)}>
            &lt; Back
          </button>
          <div className={styles.detailActions}>
            {detail.status === 'DRAFT' ? (
              <>
                {refreshEstimateTarget ? (
                  <button
                    type="button"
                    className={legacy.buttonSecondary}
                    onClick={() => setRefreshConfirmOpen(true)}
                    disabled={refreshBusy || isLocalQuoteId(detail.id) || draftSyncPending}
                  >
                    {refreshBusy
                      ? 'Refreshing...'
                      : refreshUsesLatestDesign
                        ? `Refresh from latest design (${refreshEstimateTarget.versionLabel})`
                        : 'Regenerate from current design'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={legacy.buttonSecondary}
                  onClick={handleDownloadDraftPdf}
                  disabled={downloadingDraftPdf}
                >
                  {downloadingDraftPdf ? 'Preparing PDF...' : 'Download PDF'}
                </button>
              </>
            ) : (
              <a className={legacy.buttonSecondary} href={quotePdfUrl(detail.id)}>
                Download PDF
              </a>
            )}
            {detail.status === 'DRAFT' ? (
              <>
                <button type="button" className={legacy.button} onClick={() => openSendModal('send')}>
                  Send
                </button>
                <button
                  type="button"
                  className={legacy.buttonSecondary}
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={isLocalQuoteId(detail.id) || draftSyncPending}
                >
                  Delete draft
                </button>
                {draftDirty || draftSyncPending ? (
                  <button
                    type="button"
                    className={legacy.button}
                    disabled={savingDraft || (draftSyncPending && !draftDirty)}
                    onClick={handleSaveDraft}
                  >
                    {savingDraft || draftSyncPending ? 'Syncing...' : 'Save draft'}
                  </button>
                ) : null}
              </>
            ) : (
              <>
                {openJobPackHref ? (
                  <Link className={legacy.buttonSecondary} href={openJobPackHref}>
                    Open Job Pack
                  </Link>
                ) : null}
                {canGenerateJobPack ? (
                  <button type="button" className={legacy.buttonSecondary} onClick={handleGenerateJobPack} disabled={jobPackBusy}>
                    {jobPackBusy ? 'Generating job pack...' : 'Generate Job Pack'}
                  </button>
                ) : null}
                {(detail.status === 'SENT' || detail.status === 'ACCEPTED') ? (
                  <button type="button" className={legacy.buttonSecondary} onClick={openInvoiceModal}>
                    Create invoice
                  </button>
                ) : null}
                <button type="button" className={legacy.buttonSecondary} onClick={handleRevise}>
                  Revise
                </button>
                <button type="button" className={legacy.button} onClick={handleResendClick}>
                  Resend
                </button>
              </>
            )}
          </div>
        </div>

        {expired ? (
          <div className={styles.expiredBanner}>Expired on {detail.expiresAt ?? '—'}</div>
        ) : null}

        {pagePreviewFromUrl ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>Quote preview</h4>
            </div>
            {detail.status === 'DRAFT' && draftDirty ? (
              <div className={styles.metaWarning}>Preview includes your current local draft edits before sync completes.</div>
            ) : null}
            {detail.status === 'DRAFT' && !draftDirty && draftSyncPending ? (
              <div className={styles.metaWarning}>Preview is rendered from the current local draft while background sync completes.</div>
            ) : null}
            {quotePdfPreviewLoading ? <p className={legacy.note}>Rendering quote preview...</p> : null}
            {quotePdfPreviewError ? (
              <div className={styles.errorText}>
                {quotePdfPreviewError}{' '}
                {detail.status === 'DRAFT' || isLocalQuoteId(detail.id) || draftSyncPending ? null : <a href={quotePdfUrl(detail.id)}>Download PDF</a>}
              </div>
            ) : null}
            {!quotePdfPreviewLoading && !quotePdfPreviewError && quotePdfPreviewData ? (
              <div className={styles.quotePreviewFrameWrap}>
                <QuotePdfInlinePreview key={quotePdfPreviewKey} data={quotePdfPreviewData} />
              </div>
            ) : null}
          </section>
        ) : (
          <>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h4 className={styles.cardTitle}>Quote details</h4>
            <span className={`${styles.statusPill} ${statusClass(detail.status)}`}>{statusLabel(detail.status)}</span>
          </div>
          <div className={styles.metaGrid}>
            <div className={styles.metaBlock}>
              <div className={styles.metaLabel}>Contact</div>
              <div className={styles.metaValue}>{detail.contact.name || '—'}</div>
              <div className={styles.metaValueMuted}>{detail.contact.email || '—'}</div>
              {detail.contact.phone ? <div className={styles.metaValueMuted}>{detail.contact.phone}</div> : null}
            </div>
            <div className={styles.metaBlock}>
              <div className={styles.metaLabel}>Quote number</div>
              <div className={styles.metaValue}>{detail.quoteRef}</div>
              <div className={styles.metaValueMuted}>v{detail.versionNumber}</div>
            </div>
            <div className={styles.metaBlock}>
              <div className={styles.metaLabel}>Issue date</div>
              <div className={styles.metaValue}>{detail.status === 'DRAFT' ? 'Set on send' : formatDateShort(detail.sentAt)}</div>
              <div className={styles.metaLabel}>Expiry date</div>
              {detail.status === 'DRAFT' ? (
                <input
                  className={styles.metaInput}
                  type="date"
                  value={draftExpiry}
                  onChange={(e) => setDraftExpiry(e.target.value)}
                  placeholder="30 days from send"
                />
              ) : (
                <div className={styles.metaValue}>{detail.expiresAt ?? '—'}</div>
              )}
            </div>
            <div className={styles.metaBlock}>
              <div className={styles.metaLabel}>Reference</div>
              {detail.status === 'DRAFT' ? (
                <input
                  className={styles.metaInput}
                  value={draftReference}
                  onChange={(e) => setDraftReference(e.target.value)}
                  placeholder="Optional reference"
                />
              ) : (
                <div className={styles.metaValue}>{detail.reference || '—'}</div>
              )}
            </div>
            <div className={styles.metaBlock}>
              <div className={styles.metaLabel}>Deposit %</div>
              {detail.status === 'DRAFT' ? (
                <input
                  className={styles.metaInput}
                  inputMode="decimal"
                  value={draftDepositPercent}
                  onChange={(e) => setDraftDepositPercent(normalizePercentInput(e.target.value))}
                  onBlur={(e) => setDraftDepositPercent(formatPercentInput(parsePercentInput(e.target.value)))}
                  placeholder="50"
                />
              ) : (
                <div className={styles.metaValue}>{formatPercentInput(detail.depositPercent)}%</div>
              )}
            </div>
          </div>

          <div className={styles.metaBlock}>
            <div className={styles.metaLabel}>Provenance</div>
            <div className={styles.metaValue}>
              <Link href={`/staff/projects/${encodeURIComponent(projectId)}?tab=estimates&estimateId=${encodeURIComponent(detail.sourceEstimateVersionId)}`}>
                Built from design {detail.sourceEstimateVersionLabel}
              </Link>
            </div>
            {detail.status === 'DRAFT' ? (
              <div className={styles.metaNote}>
                Draft quotes are independent once created. Design edits do not overwrite quote wording, pricing, deposit, expiry, or reference unless you explicitly refresh from design.
              </div>
            ) : null}
            {detail.status === 'DRAFT' && hasNewerEstimate ? (
              <div className={styles.metaWarning}>A newer design ({refreshEstimateTarget?.versionLabel}) exists. This quote was built from design {detail.sourceEstimateVersionLabel}.</div>
            ) : null}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h4 className={styles.cardTitle}>Line items</h4>
            {detail.status === 'DRAFT' ? (
              <button type="button" className={legacy.buttonSecondary} onClick={handleAddRow}>
                Add row
              </button>
            ) : null}
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.lineTable}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit (inc GST)</th>
                  <th>Amount</th>
                  {detail.status === 'DRAFT' ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {draftItems.map((item, idx) => {
                  const unitInputValue =
                    unitInputDrafts[item.id] ??
                    (activeUnitInputId === item.id
                      ? formatMoneyInputValue(item.unitPriceIncGstCents)
                      : formatMoneyFromCents(item.unitPriceIncGstCents).replace('$', ''));
                  const liveUnitPriceIncGstCents = detail.status === 'DRAFT' ? getLiveUnitPriceIncGstCents(item) : item.unitPriceIncGstCents;
                  const lineTotal = Math.round((Number.isFinite(item.qty) ? item.qty : 0) * liveUnitPriceIncGstCents);
                  return (
                    <tr key={item.id}>
                      <td>
                        {detail.status === 'DRAFT' ? (
                          <textarea
                            className={styles.textarea}
                            value={item.description}
                            onChange={(e) =>
                              setDraftItems((prev) =>
                                prev.map((entry, i) => (i === idx ? { ...entry, description: e.target.value } : entry)),
                              )
                            }
                            rows={3}
                          />
                        ) : (
                          <div className={styles.readonlyBlock}>{item.description}</div>
                        )}
                      </td>
                      <td>
                        {detail.status === 'DRAFT' ? (
                          <input
                            className={styles.numberInput}
                            value={String(item.qty)}
                            onChange={(e) =>
                              setDraftItems((prev) =>
                                prev.map((entry, i) => (i === idx ? { ...entry, qty: parseQtyInput(e.target.value) } : entry)),
                              )
                            }
                          />
                        ) : (
                          <div>{item.qty}</div>
                        )}
                      </td>
                      <td>
                        {detail.status === 'DRAFT' ? (
                          <input
                            className={styles.numberInput}
                            value={unitInputValue}
                            inputMode="decimal"
                            onPointerDown={(e) => {
                              if (e.currentTarget === document.activeElement) return;
                              e.preventDefault();
                              e.currentTarget.focus();
                              e.currentTarget.select();
                            }}
                            onChange={(e) =>
                              setUnitInputDrafts((prev) => ({
                                ...prev,
                                [item.id]: sanitizeMoneyInput(e.target.value),
                              }))
                            }
                            onFocus={(e) => {
                              const inputEl = e.currentTarget;
                              setActiveUnitInputId(item.id);
                              setUnitInputDrafts((prev) => {
                                if (typeof prev[item.id] === 'string') return prev;
                                return {
                                  ...prev,
                                  [item.id]: formatMoneyInputValue(item.unitPriceIncGstCents),
                                };
                              });
                              window.requestAnimationFrame(() => {
                                if (!inputEl.isConnected || document.activeElement !== inputEl) return;
                                inputEl.select();
                              });
                            }}
                            onBlur={(e) => {
                              setActiveUnitInputId((prev) => (prev === item.id ? null : prev));
                              commitUnitPriceDraft(item.id, e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              commitUnitPriceDraft(item.id, e.currentTarget.value);
                              e.currentTarget.blur();
                            }}
                          />
                        ) : (
                          <div>{formatMoneyFromCents(item.unitPriceIncGstCents)}</div>
                        )}
                      </td>
                      <td>{formatMoneyFromCents(lineTotal)}</td>
                      {detail.status === 'DRAFT' ? (
                        <td className={styles.rowActions}>
                          <button type="button" className={styles.rowButton} onClick={() => handleMoveRow(idx, -1)}>
                            Up
                          </button>
                          <button type="button" className={styles.rowButton} onClick={() => handleMoveRow(idx, 1)}>
                            Down
                          </button>
                          <button type="button" className={styles.rowButtonDanger} onClick={() => handleDeleteRow(idx)}>
                            Delete
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                {!draftItems.length ? (
                  <tr>
                    <td colSpan={detail.status === 'DRAFT' ? 5 : 4} className={styles.emptyRow}>
                      No line items.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h4 className={styles.cardTitle}>Totals</h4>
          </div>
          <div className={styles.totalsGrid}>
            <div className={styles.totalItem}>
              <div className={styles.metaLabel}>Total (inc GST)</div>
              <div className={styles.totalValue}>{detailTotals ? formatMoneyFromCents(detailTotals.totalIncGstCents) : '—'}</div>
            </div>
            <div className={styles.totalItem}>
              <div className={styles.metaLabel}>Total (ex GST)</div>
              <div className={styles.totalValue}>{detailTotals ? formatMoneyFromCents(detailTotals.totalExGstCents) : '—'}</div>
            </div>
            <div className={styles.totalItem}>
              <div className={styles.metaLabel}>GST</div>
              <div className={styles.totalValue}>{detailTotals ? formatMoneyFromCents(detailTotals.gstCents) : '—'}</div>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h4 className={styles.cardTitle}>Intro & Terms</h4>
          </div>
          <div className={styles.splitGrid}>
            <div>
              <div className={styles.metaLabel}>Intro</div>
              {detail.status === 'DRAFT' ? (
                <textarea className={styles.textarea} value={draftIntro} onChange={(e) => setDraftIntro(e.target.value)} rows={5} />
              ) : (
                <div className={styles.readonlyBlock}>{detail.introText || '—'}</div>
              )}
            </div>
            <div>
              <div className={styles.metaLabel}>Terms</div>
              {detail.status === 'DRAFT' ? (
                <textarea className={styles.textarea} value={draftTerms} onChange={(e) => setDraftTerms(e.target.value)} rows={5} />
              ) : (
                <div className={styles.readonlyBlock}>{detail.termsText || '—'}</div>
              )}
            </div>
          </div>
        </section>

        {detail.status === 'SENT' ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>Decision</h4>
              <div className={styles.cardActionsInline}>
                <button type="button" className={legacy.button} onClick={handleAccept}>
                  Mark accepted
                </button>
                <button type="button" className={legacy.buttonSecondary} onClick={handleDecline}>
                  Mark declined
                </button>
              </div>
            </div>
            <p className={styles.muted}>These actions lock the quote and trigger the deposit invoice workflow.</p>
          </section>
        ) : null}

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h4 className={styles.cardTitle}>Send log</h4>
          </div>
          {detail.sendLogs.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.logTable}>
                <thead>
                  <tr>
                    <th>Sent to</th>
                    <th>Subject</th>
                    <th>When</th>
                    <th>Status</th>
                    <th>Attachments</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.sendLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.to.join(', ') || '—'}</td>
                      <td>{log.subject || '—'}</td>
                      <td>{formatDateTime(log.sentAt ?? log.createdAt)}</td>
                      <td>{log.status}</td>
                      <td>{log.attachments.length ? `${log.attachments.length} file${log.attachments.length === 1 ? '' : 's'}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.muted}>No send attempts yet.</p>
          )}
        </section>
          </>
        )}

        {refreshConfirmOpen ? (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h4 className={styles.cardTitle}>
                  {refreshUsesLatestDesign ? 'Refresh from latest design?' : 'Regenerate from current design?'}
                </h4>
                <button type="button" className={styles.modalClose} onClick={() => setRefreshConfirmOpen(false)} disabled={refreshBusy}>
                  Close
                </button>
              </div>
              <p className={styles.modalBodyText}>
                {refreshUsesLatestDesign
                  ? `This will rebuild the draft from ${refreshEstimateTarget?.versionLabel}.`
                  : 'This will rebuild the draft from the current design snapshot.'}
              </p>
              <p className={styles.modalBodyText}>
                Manual edits to wording, line items, pricing, deposit, expiry, and reference will be replaced or reset.
              </p>
              <div className={styles.modalFooter}>
                <button type="button" className={legacy.buttonSecondary} onClick={() => setRefreshConfirmOpen(false)} disabled={refreshBusy}>
                  Cancel
                </button>
                <button type="button" className={legacy.button} onClick={() => void handleRefreshFromEstimate()} disabled={refreshBusy}>
                  {refreshBusy ? 'Refreshing...' : refreshUsesLatestDesign ? 'Refresh from design' : 'Regenerate draft'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {invoiceOpen ? (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h4 className={styles.cardTitle}>Create invoice</h4>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => closeInvoiceModal()}
                >
                  Close
                </button>
              </div>
              <div className={styles.modalBody}>
                <p className={styles.modalBodyText}>Create a deposit invoice from this quote now, or create it first and send it later from the Invoices tab.</p>
                <label className={styles.metaLabel} htmlFor="invoiceDepositPercent">Deposit %</label>
                <input
                  id="invoiceDepositPercent"
                  className={styles.metaInput}
                  inputMode="decimal"
                  value={invoiceDepositPercent}
                  onChange={(e) => setInvoiceDepositPercent(normalizePercentInput(e.target.value))}
                  onBlur={(e) => setInvoiceDepositPercent(formatPercentInput(parsePercentInput(e.target.value)))}
                />
                <label className={styles.metaLabel} htmlFor="invoiceDueDate">Due date</label>
                <input
                  id="invoiceDueDate"
                  className={styles.metaInput}
                  type="date"
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                />
                <label className={styles.metaLabel} htmlFor="invoiceReference">Reference</label>
                <input
                  id="invoiceReference"
                  className={styles.metaInput}
                  value={invoiceReference}
                  onChange={(e) => setInvoiceReference(e.target.value)}
                />
                {invoiceError ? <div className={styles.errorText}>{invoiceError}</div> : null}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={legacy.buttonSecondary} onClick={() => closeInvoiceModal()} disabled={invoiceBusy}>
                  Cancel
                </button>
                <button type="button" className={legacy.buttonSecondary} onClick={() => void handleCreateInvoice(false)} disabled={invoiceBusy}>
                  {invoiceBusy ? 'Working...' : 'Create only'}
                </button>
                <button type="button" className={legacy.button} onClick={() => void handleCreateInvoice(true)} disabled={invoiceBusy}>
                  {invoiceBusy ? 'Working...' : 'Create & send'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {sendOpen ? (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modal} ${styles.modalWide}`}>
              <div className={styles.modalHeader}>
                <h4 className={styles.cardTitle}>{sendMode === 'send' ? 'Send quote' : 'Resend quote'}</h4>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => closeSendModal()}
                >
                  Close
                </button>
              </div>
              <div className={styles.modalModeSwitch} role="tablist" aria-label="Email editor mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={sendEditorMode === 'compose'}
                  className={`${styles.modalModeButton} ${sendEditorMode === 'compose' ? styles.modalModeButtonActive : ''}`}
                  onClick={() => setSendEditorMode('compose')}
                >
                  Compose
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sendEditorMode === 'preview'}
                  className={`${styles.modalModeButton} ${sendEditorMode === 'preview' ? styles.modalModeButtonActive : ''}`}
                  onClick={() => setSendEditorMode('preview')}
                >
                  Preview
                </button>
              </div>
              {sendEditorMode === 'compose' ? (
                <div className={styles.modalBody}>
                  <label className={styles.metaLabel} htmlFor="sendTo">To</label>
                  <input id="sendTo" className={styles.metaInput} value={sendTo} onChange={(e) => setSendTo(e.target.value)} />
                  <label className={styles.metaLabel} htmlFor="sendSubject">Subject</label>
                  <input id="sendSubject" className={styles.metaInput} value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} />
                  <label className={styles.metaLabel} htmlFor="sendBody">Personal note (optional)</label>
                  <textarea
                    id="sendBody"
                    className={styles.textarea}
                    value={sendPersonalNote}
                    onChange={(e) => setSendPersonalNote(e.target.value)}
                    rows={6}
                    placeholder="Optional custom note to include in the template."
                  />
                  <label className={styles.metaLabel} htmlFor="sendDesignPdf">Design PDF (optional)</label>
                  <input
                    id="sendDesignPdf"
                    className={styles.fileInput}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => {
                      const nextFile = event.currentTarget.files?.[0] ?? null;
                      if (!nextFile) {
                        setSendDesignPdf(null);
                        setSendError(null);
                        return;
                      }
                      const validation = validateDesignPdf(nextFile);
                      if (validation) {
                        event.currentTarget.value = '';
                        setSendDesignPdf(null);
                        setSendError(validation);
                        toast.error(validation);
                        return;
                      }
                      setSendDesignPdf(nextFile);
                      setSendError(null);
                    }}
                  />
                  <div className={styles.attachmentsHint}>
                    Attachments: Quote PDF (auto attached).
                    {sendDesignPdf
                      ? ` Design PDF selected: ${sendDesignPdf.name} (${formatFileSize(sendDesignPdf.size)}).`
                      : ' You can add one design PDF up to 20MB.'}
                  </div>
                  {sendError ? <div className={styles.errorText}>{sendError}</div> : null}
                </div>
              ) : (
                <div className={styles.modalBody}>
                  <div className={styles.previewMetaGrid}>
                    <div className={styles.previewMetaItem}>
                      <div className={styles.metaLabel}>To</div>
                      <div className={styles.previewMetaValue}>{sendTo || '—'}</div>
                    </div>
                    <div className={styles.previewMetaItem}>
                      <div className={styles.metaLabel}>Subject</div>
                      <div className={styles.previewMetaValue}>{sendSubject || '—'}</div>
                    </div>
                  </div>
                  <p className={styles.attachmentsHint}>
                    Preview shows rendered email HTML. Action links are illustrative in preview mode.
                  </p>
                  {sendPreviewLoading ? <p className={legacy.note}>Loading preview...</p> : null}
                  {sendPreviewError ? <div className={styles.errorText}>{sendPreviewError}</div> : null}
                  {!sendPreviewLoading && !sendPreviewError && !sendPreviewHtml ? <p className={legacy.note}>No preview available.</p> : null}
                  {!sendPreviewError && sendPreviewHtml ? (
                    <div className={styles.previewFrameWrap}>
                      <iframe
                        ref={sendPreviewFrameRef}
                        title="Quote email preview"
                        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                        style={{ width: '100%', height: sendPreviewHeight, border: 0, background: '#fff', display: 'block' }}
                        srcDoc={sendPreviewHtml}
                        onLoad={() => {
                          sizeSendPreviewIframe();
                          setTimeout(sizeSendPreviewIframe, 50);
                          setTimeout(sizeSendPreviewIframe, 250);
                        }}
                        scrolling="no"
                      />
                    </div>
                  ) : null}
                </div>
              )}
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={legacy.buttonSecondary}
                  onClick={() => closeSendModal()}
                >
                  Cancel
                </button>
                <button type="button" className={legacy.button} onClick={handleSend} disabled={sendBusy}>
                  {sendBusy ? 'Sending...' : sendMode === 'send' ? 'Send quote' : 'Resend quote'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {expiredPromptOpen ? (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h4 className={styles.cardTitle}>Quote expired</h4>
                <button type="button" className={styles.modalClose} onClick={() => setExpiredPromptOpen(false)}>
                  Close
                </button>
              </div>
              <p className={styles.modalBodyText}>This quote expired on {detail.expiresAt ?? '—'}. How would you like to proceed?</p>
              <div className={styles.modalFooter}>
                <button type="button" className={legacy.buttonSecondary} onClick={() => handleExpiredResend('resend')}>
                  Resend as-is
                </button>
                <button type="button" className={legacy.button} onClick={() => handleExpiredResend('revise')}>
                  Revise to extend expiry
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteConfirmOpen ? (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h4 className={styles.cardTitle}>Delete draft?</h4>
                <button type="button" className={styles.modalClose} onClick={() => setDeleteConfirmOpen(false)}>
                  Close
                </button>
              </div>
              <p className={styles.modalBodyText}>This will remove the draft quote version. Sent quotes cannot be deleted.</p>
              <div className={styles.modalFooter}>
                <button type="button" className={legacy.buttonSecondary} onClick={() => setDeleteConfirmOpen(false)}>
                  Cancel
                </button>
                <button type="button" className={legacy.buttonDanger} onClick={handleDeleteDraft}>
                  Delete draft
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Quotes</h3>
          <p className={styles.subtitle}>Versioned quotes for this project.</p>
        </div>
        <button type="button" className={legacy.button} onClick={openCreateModal}>
          Create quote
        </button>
      </div>

      {quotesLoading ? <p className={legacy.note}>Loading quotes…</p> : null}
      {quotesError ? <p className={legacy.error}>{quotesError}</p> : null}

      {!quotesLoading && !quotes.length ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No quotes yet.</p>
          <button type="button" className={legacy.button} onClick={openCreateModal}>
            Create quote from design
          </button>
        </div>
      ) : null}

      {quotes.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.listTable}>
            <thead>
              <tr>
                <th>Quote</th>
                <th>From design</th>
                <th>Issue date</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Amount (inc GST)</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const expired = isExpired(quote.expiresAt);
                const quoteSyncPending = getAliasedLocalFirstEntitySyncState(quote.id, buildQuoteEntityKey).pendingCount > 0;
                return (
                  <tr
                    key={quote.id}
                    className={styles.rowClickable}
                    onClick={() => {
                      if (!isLocalQuoteId(quote.id)) {
                        prefetchQuoteDetail(quote.id);
                      }
                      selectQuote(quote.id);
                    }}
                    onMouseEnter={() => prefetchQuoteDetail(quote.id)}
                    onFocus={() => prefetchQuoteDetail(quote.id)}
                  >
                    <td>{`${quote.quoteRef} • v${quote.versionNumber}`}</td>
                    <td>{quote.sourceEstimateVersionLabel}</td>
                    <td>{quote.status === 'DRAFT' ? '—' : formatDateShort(quote.sentAt)}</td>
                    <td>
                      {quote.expiresAt ? (
                        <span className={expired ? styles.expiredText : undefined}>
                          {quote.expiresAt}{expired ? ' (Expired)' : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={`${styles.statusPill} ${statusClass(quote.status)}`}>{statusLabel(quote.status)}</span>
                    </td>
                    <td>{formatMoneyFromCents(quote.totals.totalIncGstCents)}</td>
                    <td>
                      {isLocalQuoteId(quote.id) || quoteSyncPending ? (
                        <span className={styles.linkMuted}>Syncing</span>
                      ) : quote.pdfFileId ? (
                        <a href={quotePdfUrl(quote.id)} onClick={(event) => event.stopPropagation()}>
                          PDF
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {createOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h4 className={styles.cardTitle}>Create quote</h4>
              <button type="button" className={styles.modalClose} onClick={() => setCreateOpen(false)}>
                Close
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.metaLabel} htmlFor="estimateSelect">Select design version</label>
              <select
                id="estimateSelect"
                className={styles.metaInput}
                value={createEstimateId}
                onChange={(e) => setCreateEstimateId(e.target.value)}
                disabled={estimatesLoading}
              >
                {estimates.map((estimate) => (
                  <option key={estimate.id} value={estimate.id}>
                    {estimate.isActiveDraft ? 'Current draft design' : `Design ${estimate.versionLabel}`}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={legacy.buttonSecondary} onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="button" className={legacy.button} onClick={handleCreateQuote}>
                Create quote
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
