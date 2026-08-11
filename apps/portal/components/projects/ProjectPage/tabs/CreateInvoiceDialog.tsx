'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { AlertBanner, Button, Checkbox, Input, Select, Textarea } from '@/components/ui/foundation';
import type {
  AdminInvoiceCreateInput,
  AdminInvoiceCreationMode,
  InvoiceScheduleTerm,
  ProjectInvoiceSchedule,
  QuoteInvoiceCreateResult,
} from '@/lib/invoices/types';
import styles from './InvoiceActionDialogs.module.css';

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function dollarsToCents(value: string): number {
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function defaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export default function CreateInvoiceDialog({
  open,
  projectId,
  schedule,
  initialTerm,
  pending,
  result,
  onClose,
  onCreate,
  onPreview,
}: {
  open: boolean;
  projectId: string;
  schedule: ProjectInvoiceSchedule;
  initialTerm: InvoiceScheduleTerm | null;
  pending: boolean;
  result: QuoteInvoiceCreateResult | null;
  onClose: () => void;
  onCreate: (input: AdminInvoiceCreateInput) => void;
  onPreview: (result: QuoteInvoiceCreateResult) => void;
}) {
  const firstRef = useRef<HTMLSelectElement | null>(null);
  const [mode, setMode] = useState<AdminInvoiceCreationMode>('next_stage');
  const [quoteVersionId, setQuoteVersionId] = useState('');
  const [termId, setTermId] = useState('');
  const [label, setLabel] = useState('Progress payment');
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [reference, setReference] = useState('');
  const [basis, setBasis] = useState<'fixed' | 'percentage'>('fixed');
  const [customValue, setCustomValue] = useState('');
  const [splitCount, setSplitCount] = useState('2');
  const [sendNow, setSendNow] = useState(false);
  const [allowOverInvoice, setAllowOverInvoice] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    if (!open) return;
    const term = initialTerm ?? schedule.terms.find((item) => !item.invoice && item.remainingAmountIncGstCents > 0) ?? null;
    const initialQuoteVersionId = term?.quoteVersionId
      ?? schedule.acceptedQuotes?.find((quote) => quote.remainingToInvoiceIncGstCents > 0)?.quoteVersionId
      ?? schedule.acceptedQuoteVersionId
      ?? '';
    setMode('next_stage');
    setQuoteVersionId(initialQuoteVersionId);
    setTermId(term?.paymentTermId ?? '');
    setLabel(term?.label ?? 'Progress payment');
    setDueDate(defaultDueDate());
    setReference('');
    setBasis('fixed');
    setCustomValue('');
    setSplitCount('2');
    setSendNow(false);
    setAllowOverInvoice(false);
    setOverrideReason('');
  }, [initialTerm, open, schedule]);

  const acceptedQuotes = schedule.acceptedQuotes?.length
    ? schedule.acceptedQuotes
    : schedule.acceptedQuoteVersionId
      ? [{
          quoteVersionId: schedule.acceptedQuoteVersionId,
          quoteRef: schedule.acceptedQuoteRef ?? '',
          quoteVersionNumber: schedule.acceptedQuoteVersionNumber ?? 0,
          commercialScopeKind: 'base' as const,
          totalIncGstCents: schedule.acceptedQuoteTotalIncGstCents,
          remainingToInvoiceIncGstCents: schedule.remainingToInvoiceIncGstCents,
        }]
      : [];
  const selectedQuote = acceptedQuotes.find((quote) => quote.quoteVersionId === quoteVersionId) ?? acceptedQuotes[0] ?? null;
  const selectedQuoteRemaining = selectedQuote?.remainingToInvoiceIncGstCents ?? 0;
  const selectedTerm = schedule.terms.find((term) =>
    term.quoteVersionId === selectedQuote?.quoteVersionId && term.paymentTermId === termId,
  ) ?? null;
  const amount = useMemo(() => {
    if (mode === 'next_stage') return selectedTerm?.remainingAmountIncGstCents ?? 0;
    if (mode === 'full_remaining') return selectedQuoteRemaining;
    if (mode === 'split') return Math.floor(selectedQuoteRemaining / Math.max(2, Number(splitCount) || 2));
    if (basis === 'percentage') {
      return Math.round(selectedQuoteRemaining * (Number(customValue) || 0) / 100);
    }
    return dollarsToCents(customValue);
  }, [basis, customValue, mode, selectedQuoteRemaining, selectedTerm, splitCount]);
  const exceedsRemaining = amount > selectedQuoteRemaining;
  const valid = amount > 0
    && Boolean(selectedQuote)
    && label.trim().length >= 2
    && (mode !== 'next_stage' || Boolean(termId))
    && (mode !== 'split' || Number(splitCount) >= 2)
    && (!exceedsRemaining || (allowOverInvoice && overrideReason.trim().length >= 3));

  const submit = () => onCreate({
    projectId,
    quoteVersionId: selectedQuote?.quoteVersionId ?? '',
    mode,
    paymentTermId: mode === 'next_stage' ? termId : null,
    amountIncGstCents: mode === 'custom' ? amount : null,
    splitCount: mode === 'split' ? Number(splitCount) : null,
    label: label.trim(),
    dueDate,
    reference: reference.trim() || null,
    sendNow,
    allowOverInvoice: exceedsRemaining && allowOverInvoice,
    overrideReason: exceedsRemaining ? overrideReason.trim() : null,
    calculationBasis: mode === 'custom' ? basis : 'fixed',
    percentage: mode === 'custom' && basis === 'percentage' ? Number(customValue) : null,
  });

  return (
    <Modal open={open} onClose={() => { if (!pending) onClose(); }} ariaLabel="Create invoice" initialFocusRef={firstRef} maxWidthPx={680} closeOnBackdrop={!pending} closeOnEsc={!pending}>
      <div className={styles.content}>
        <header>
          <h2>Create invoice</h2>
          <p>Create one whole invoice. Future instalments are planned only and can be invoiced later.</p>
        </header>
        {result ? (
          <>
            <AlertBanner tone={result.sendError ? 'warning' : 'info'} title={`${result.invoice.invoiceRef} created`}>
              {result.sendError ?? `${money(result.remainingAfterIncGstCents ?? 0)} remains available to invoice.`}
            </AlertBanner>
            <div className={styles.summaryGrid}>
              <span><small>Invoice</small><strong>{money(result.invoice.totalIncGstCents)}</strong></span>
              <span><small>Remaining before</small><strong>{money(result.remainingBeforeIncGstCents ?? 0)}</strong></span>
              <span><small>Remaining after</small><strong>{money(result.remainingAfterIncGstCents ?? 0)}</strong></span>
            </div>
            <footer>
              <Button variant="tertiary" onClick={onClose}>Close</Button>
              <Button onClick={() => onPreview(result)}>Preview invoice</Button>
            </footer>
          </>
        ) : (
          <>
            <div className={styles.fields}>
              {acceptedQuotes.length > 1 ? (
                <Select label="Quote scope" value={selectedQuote?.quoteVersionId ?? ''} onChange={(event) => {
                  const nextQuoteVersionId = event.target.value;
                  setQuoteVersionId(nextQuoteVersionId);
                  const nextTerm = schedule.terms.find((term) =>
                    term.quoteVersionId === nextQuoteVersionId && !term.invoice && term.remainingAmountIncGstCents > 0,
                  );
                  setTermId(nextTerm?.paymentTermId ?? '');
                  setLabel(nextTerm?.label ?? 'Progress payment');
                }} disabled={pending}>
                  {acceptedQuotes.map((quote) => (
                    <option key={quote.quoteVersionId} value={quote.quoteVersionId}>
                      {quote.commercialScopeKind === 'add_on' ? 'Add-on · ' : ''}{quote.quoteRef} v{quote.quoteVersionNumber} — {money(quote.remainingToInvoiceIncGstCents)} remaining
                    </option>
                  ))}
                </Select>
              ) : null}
              <Select ref={firstRef} label="Invoice amount" value={mode} onChange={(event) => setMode(event.target.value as AdminInvoiceCreationMode)} disabled={pending}>
                <option value="next_stage">Next scheduled stage</option>
                <option value="full_remaining">Full remaining balance</option>
                <option value="custom">Custom amount</option>
                <option value="split">Split remaining into instalments</option>
              </Select>
              {mode === 'next_stage' ? (
                <Select label="Payment stage" value={termId} onChange={(event) => {
                  setTermId(event.target.value);
                  const term = schedule.terms.find((item) =>
                    item.quoteVersionId === selectedQuote?.quoteVersionId && item.paymentTermId === event.target.value,
                  );
                  if (term) setLabel(term.label);
                }} disabled={pending}>
                  <option value="">Select a stage</option>
                  {schedule.terms.filter((term) =>
                    term.quoteVersionId === selectedQuote?.quoteVersionId && !term.invoice && term.remainingAmountIncGstCents > 0,
                  ).map((term) => (
                    <option key={term.paymentTermId} value={term.paymentTermId}>{term.label} — {money(term.remainingAmountIncGstCents)}</option>
                  ))}
                </Select>
              ) : null}
              {mode === 'custom' ? (
                <div className={styles.inlineFields}>
                  <Select label="Custom amount type" value={basis} onChange={(event) => setBasis(event.target.value as 'fixed' | 'percentage')} disabled={pending}>
                    <option value="fixed">Dollar amount</option>
                    <option value="percentage">Percentage of remaining</option>
                  </Select>
                  <Input label={basis === 'fixed' ? 'Amount ($)' : 'Percentage (%)'} inputMode="decimal" value={customValue} onChange={(event) => setCustomValue(event.target.value)} disabled={pending} />
                </div>
              ) : null}
              {mode === 'split' ? (
                <Select label="Number of instalments" value={splitCount} onChange={(event) => setSplitCount(event.target.value)} disabled={pending}>
                  {Array.from({ length: 9 }, (_, index) => index + 2).map((count) => <option value={count} key={count}>{count} instalments</option>)}
                </Select>
              ) : null}
              <AlertBanner tone="info" title={`Invoice amount: ${money(amount)}`}>
                {selectedQuote?.commercialScopeKind === 'add_on' ? 'Add-on' : 'Base quote'} available {money(selectedQuoteRemaining)}. Job paid {money(schedule.paidIncGstCents)} and open {money(schedule.outstandingIncGstCents)}.
              </AlertBanner>
              <Input label="Invoice label" value={label} onChange={(event) => setLabel(event.target.value)} disabled={pending} required />
              <div className={styles.inlineFields}>
                <Input label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={pending} />
                <Input label="Reference (optional)" value={reference} onChange={(event) => setReference(event.target.value)} disabled={pending} />
              </div>
              <Checkbox label="Create and send now" description="Leave unchecked to save the invoice without sending." checked={sendNow} onChange={(event) => setSendNow(event.target.checked)} disabled={pending} />
              {exceedsRemaining ? (
                <AlertBanner tone="blocking" title="This exceeds the remaining job balance">
                  <Checkbox label="Allow over-invoicing" checked={allowOverInvoice} onChange={(event) => setAllowOverInvoice(event.target.checked)} disabled={pending} />
                  <Textarea label="Override reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} rows={3} disabled={pending || !allowOverInvoice} required />
                </AlertBanner>
              ) : null}
            </div>
            <footer>
              <Button variant="tertiary" onClick={onClose} disabled={pending}>Cancel</Button>
              <Button onClick={submit} disabled={!valid} loading={pending}>{sendNow ? 'Create and send' : 'Create invoice'}</Button>
            </footer>
          </>
        )}
      </div>
    </Modal>
  );
}
