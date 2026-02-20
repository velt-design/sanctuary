'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import legacy from '@/app/staff/projects/projects.module.css';
import styles from './QuotesTab.module.css';
import type { EstimateMeta } from '@/lib/estimates/types';
import type { QuoteLineItem, QuoteStatus, QuoteVersion, QuoteVersionDetail } from '@/lib/quotes/types';
import {
  createQuoteFromEstimate,
  deleteDraftQuoteVersion,
  markQuoteAccepted,
  markQuoteDeclined,
  quotePdfUrl,
  resendQuote,
  reviseQuote,
  sendQuote,
  updateDraftQuoteVersion,
} from '@/lib/quotes/quotesRepo';
import { quoteVersionDetailQueryOptions, quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { qk } from '@/lib/queries/keys';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

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

export default function QuotesTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  const selectedFromUrl = useMemo(() => {
    const raw = searchParams.get('quoteId') ?? '';
    return raw.trim() || null;
  }, [searchParams]);

  const [selectedId, setSelectedId] = useState<string | null>(selectedFromUrl);

  const quotesQuery = useQuery(quoteVersionsByProjectQueryOptions(hostKey, projectId));
  const estimatesQuery = useQuery(estimateMetasByProjectQueryOptions(hostKey, projectId));

  const quotes = quotesQuery.data ?? [];
  const quotesLoading = quotesQuery.isPending;
  const quotesError =
    quotesQuery.error instanceof Error ? quotesQuery.error.message : quotesQuery.error ? String(quotesQuery.error) : null;

  const estimates = estimatesQuery.data ?? [];
  const estimatesLoading = estimatesQuery.isPending;

  const quoteDetailQuery = useQuery({
    ...quoteVersionDetailQueryOptions(hostKey, selectedId || ''),
    enabled: Boolean(selectedId),
  });
  const detailLoading = Boolean(selectedId) && quoteDetailQuery.isPending;
  const detail = quoteDetailQuery.data ?? null;

  const [createOpen, setCreateOpen] = useState(false);
  const [createEstimateId, setCreateEstimateId] = useState('');

  const [sendOpen, setSendOpen] = useState(false);
  const [sendMode, setSendMode] = useState<'send' | 'resend'>('send');
  const [sendTo, setSendTo] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendPersonalNote, setSendPersonalNote] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [expiredPromptOpen, setExpiredPromptOpen] = useState(false);
  const [pendingResendId, setPendingResendId] = useState<string | null>(null);

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

  const refreshQuotes = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.quotes.versionsByProject(hostKey, projectId) });
  }, [hostKey, projectId, queryClient]);

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
    setSelectedId(selectedFromUrl);
  }, [selectedFromUrl]);

  useEffect(() => {
    if (!detail) return;
    setDraftItems(detail.lineItems);
    setUnitInputDrafts({});
    setActiveUnitInputId(null);
    setDraftReference(detail.reference ?? '');
    setDraftIntro(detail.introText ?? '');
    setDraftTerms(detail.termsText ?? '');
    setDraftDepositPercent(formatPercentInput(detail.depositPercent));
    setDraftExpiry(detail.expiresAt ?? '');
  }, [detail?.id]);

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

  const updateParams = (next: { quoteId?: string | null }) => {
    const qs = new URLSearchParams(searchParams.toString());
    if (!next.quoteId) qs.delete('quoteId');
    else qs.set('quoteId', next.quoteId);
    router.replace(`?${qs.toString()}`);
  };

  const latestEstimate = useMemo(() => {
    if (!estimates.length) return null;
    return [...estimates].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }, [estimates]);

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

  const openCreateModal = () => {
    const defaultId = latestEstimate?.id ?? estimates[0]?.id ?? '';
    if (!defaultId) {
      toast.error('Create an estimate first.');
      return;
    }
    setCreateEstimateId(defaultId);
    setCreateOpen(true);
  };

  const handleCreateQuote = async () => {
    if (!createEstimateId) return;
    try {
      const created = await createQuoteFromEstimate(projectId, createEstimateId);
      queryClient.setQueryData(qk.quotes.detail(hostKey, created.id), created);
      await refreshQuotes();
      setCreateOpen(false);
      setSelectedId(created.id);
      updateParams({ quoteId: created.id });
      toast.success('Draft quote created.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create quote';
      toast.error(msg);
    }
  };

  const openSendModal = (mode: 'send' | 'resend') => {
    if (!detail) return;
    if (mode === 'send' && draftDirty) {
      toast.error('Save the draft before sending.');
      return;
    }
    const to = detail.contact?.email ?? '';
    setSendMode(mode);
    setSendTo(to);
    setSendSubject(defaultSubject(detail.quoteRef));
    setSendPersonalNote(defaultPersonalNote());
    setSendError(null);
    setSendOpen(true);
  };

  const handleSend = async () => {
    if (!detail || sendBusy) return;
    if (sendMode === 'send' && draftDirty) {
      toast.error('Save the draft before sending.');
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
    setSendBusy(true);
    setSendError(null);
    try {
      const updated = sendMode === 'send'
        ? await sendQuote(detail.id, { to, subject: sendSubject, personalNote: sendPersonalNote })
        : await resendQuote(detail.id, { to, subject: sendSubject, personalNote: sendPersonalNote });
      queryClient.setQueryData(qk.quotes.detail(hostKey, updated.id), updated);
      setDraftItems(updated.lineItems);
      setUnitInputDrafts({});
      setActiveUnitInputId(null);
      setSendOpen(false);
      setSendError(null);
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
      await refreshQuotes();
      setSelectedId(revised.id);
      updateParams({ quoteId: revised.id });
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
      const updated = await updateDraftQuoteVersion(detail.id, {
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
      queryClient.setQueryData(qk.quotes.detail(hostKey, updated.id), updated);
      setDraftItems(updated.lineItems);
      setUnitInputDrafts({});
      setActiveUnitInputId(null);
      setDraftReference(updated.reference ?? '');
      setDraftIntro(updated.introText ?? '');
      setDraftTerms(updated.termsText ?? '');
      setDraftDepositPercent(formatPercentInput(updated.depositPercent));
      setDraftExpiry(updated.expiresAt ?? '');
      await refreshQuotes();
      toast.success('Draft saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save draft';
      toast.error(msg);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!detail) return;
    try {
      await deleteDraftQuoteVersion(detail.id);
      queryClient.removeQueries({ queryKey: qk.quotes.detail(hostKey, detail.id) });
      setDeleteConfirmOpen(false);
      setSelectedId(null);
      updateParams({ quoteId: null });
      await refreshQuotes();
      toast.success('Draft deleted.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete draft';
      toast.error(msg);
    }
  };

  const handleAccept = async () => {
    if (!detail) return;
    try {
      const updated = await markQuoteAccepted(detail.id);
      queryClient.setQueryData(qk.quotes.detail(hostKey, updated.id), updated);
      await refreshQuotes();
      toast.success('Quote accepted and deposit invoice triggered.');
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
    const hasNewerEstimate = latestEstimate && latestEstimate.id !== detail.sourceEstimateVersionId;

    return (
      <div className={styles.wrapper}>
        <div className={styles.detailHeader}>
          <button type="button" className={styles.backButton} onClick={() => updateParams({ quoteId: null })}>
            &lt; Back
          </button>
          <div className={styles.detailActions}>
            <a className={legacy.buttonSecondary} href={quotePdfUrl(detail.id)}>
              Download PDF
            </a>
            {detail.status === 'DRAFT' ? (
              <>
                <button type="button" className={legacy.button} onClick={() => openSendModal('send')}>
                  Send
                </button>
                <button type="button" className={legacy.buttonSecondary} onClick={() => setDeleteConfirmOpen(true)}>
                  Delete draft
                </button>
                {draftDirty ? (
                  <button type="button" className={legacy.button} disabled={savingDraft} onClick={handleSaveDraft}>
                    {savingDraft ? 'Saving…' : 'Save draft'}
                  </button>
                ) : null}
              </>
            ) : (
              <>
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
                Generated from {detail.sourceEstimateVersionLabel}
              </Link>
            </div>
            {detail.status === 'DRAFT' && hasNewerEstimate ? (
              <div className={styles.metaWarning}>A newer estimate ({latestEstimate?.versionLabel}) exists. This quote was generated from {detail.sourceEstimateVersionLabel}.</div>
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
                      <td>{log.attachments.length ? 'Quote PDF' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.muted}>No send attempts yet.</p>
          )}
        </section>

        {sendOpen ? (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h4 className={styles.cardTitle}>{sendMode === 'send' ? 'Send quote' : 'Resend quote'}</h4>
                <button type="button" className={styles.modalClose} onClick={() => setSendOpen(false)}>
                  Close
                </button>
              </div>
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
                <div className={styles.attachmentsHint}>Attachments: Quote PDF (auto attached). Additional attachments coming soon.</div>
                {sendError ? <div className={styles.errorText}>{sendError}</div> : null}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={legacy.buttonSecondary} onClick={() => setSendOpen(false)}>
                  Cancel
                </button>
                <button type="button" className={legacy.button} onClick={handleSend} disabled={sendBusy}>
                  {sendBusy ? 'Sending…' : sendMode === 'send' ? 'Send quote' : 'Resend quote'}
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
            Create quote from estimate
          </button>
        </div>
      ) : null}

      {quotes.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.listTable}>
            <thead>
              <tr>
                <th>Quote</th>
                <th>From estimate</th>
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
                return (
                  <tr key={quote.id} className={styles.rowClickable} onClick={() => updateParams({ quoteId: quote.id })}>
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
                      {quote.pdfFileId ? (
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
              <label className={styles.metaLabel} htmlFor="estimateSelect">Select estimate version</label>
              <select
                id="estimateSelect"
                className={styles.metaInput}
                value={createEstimateId}
                onChange={(e) => setCreateEstimateId(e.target.value)}
                disabled={estimatesLoading}
              >
                {estimates.map((estimate) => (
                  <option key={estimate.id} value={estimate.id}>
                    {estimate.versionLabel}
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
