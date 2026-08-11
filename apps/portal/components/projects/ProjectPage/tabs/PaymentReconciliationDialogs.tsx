'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { AlertBanner, Button, Input, Select, Textarea } from '@/components/ui/foundation';
import type { ProjectInvoiceSchedule, ProjectPaymentEntrySummary } from '@/lib/invoices/types';
import styles from './InvoiceActionDialogs.module.css';

function toCents(value: string): number {
  const amount = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type AllocationDraft = { quoteVersionId: string; paymentTermId: string; amount: string };

function allocationTargetValue(quoteVersionId: string, paymentTermId: string): string {
  return quoteVersionId && paymentTermId ? `${quoteVersionId}::${paymentTermId}` : '';
}

export default function PaymentReconciliationDialogs({
  entryMode,
  allocationTarget,
  reversalTarget,
  schedule,
  pending,
  onClose,
  onRecord,
  onAllocate,
  onReverse,
}: {
  entryMode: 'PAYMENT' | 'ADJUSTMENT' | null;
  allocationTarget: ProjectPaymentEntrySummary | null;
  reversalTarget: ProjectPaymentEntrySummary | null;
  schedule: ProjectInvoiceSchedule;
  pending: boolean;
  onClose: () => void;
  onRecord: (input: { entryType: 'PAYMENT' | 'ADJUSTMENT'; amountIncGstCents: number; occurredAt: string; paymentMethod: string; reference: string; note: string; reason: string }) => void;
  onAllocate: (input: { allocations: Array<{ quoteVersionId: string; paymentTermId: string; amountIncGstCents: number }>; reason: string }) => void;
  onReverse: (reason: string) => void;
}) {
  const amountRef = useRef<HTMLInputElement | null>(null);
  const [amount, setAmount] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [method, setMethod] = useState('bank transfer');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [allocations, setAllocations] = useState<AllocationDraft[]>([{ quoteVersionId: '', paymentTermId: '', amount: '' }]);

  useEffect(() => {
    if (entryMode) {
      setAmount('');
      setOccurredAt(new Date().toISOString().slice(0, 10));
      setMethod('bank transfer');
      setReference('');
      setNote('');
      setReason('');
    }
  }, [entryMode]);

  useEffect(() => {
    if (!allocationTarget) return;
    const current = allocationTarget.allocations.filter((item) => item.isCurrentSchedule);
    setAllocations(current.length
      ? current.map((item) => ({
          quoteVersionId: item.quoteVersionId,
          paymentTermId: item.paymentTermId,
          amount: (item.amountIncGstCents / 100).toFixed(2),
        }))
      : [{ quoteVersionId: '', paymentTermId: '', amount: '' }]);
    setReason('');
  }, [allocationTarget]);

  useEffect(() => { if (reversalTarget) setReason(''); }, [reversalTarget]);

  const allocationTotal = allocations.reduce((sum, item) => sum + toCents(item.amount), 0);
  const uniqueAllocationTargets = new Set(
    allocations.map((item) => allocationTargetValue(item.quoteVersionId, item.paymentTermId)),
  ).size === allocations.length;
  const allocationValid = allocations.every((item) => item.quoteVersionId && item.paymentTermId && toCents(item.amount) > 0)
    && uniqueAllocationTargets
    && allocationTotal <= (allocationTarget?.amountIncGstCents ?? 0)
    && reason.trim().length >= 3;

  return (
    <>
      <Modal open={Boolean(entryMode)} onClose={() => { if (!pending) onClose(); }} ariaLabel={entryMode === 'PAYMENT' ? 'Record payment' : 'Add payment adjustment'} initialFocusRef={amountRef} maxWidthPx={560} closeOnBackdrop={!pending} closeOnEsc={!pending}>
        <div className={styles.content}>
          <header>
            <h2>{entryMode === 'PAYMENT' ? 'Record payment' : 'Add adjustment'}</h2>
            <p>{entryMode === 'PAYMENT' ? 'Record money actually received for this job.' : 'Correct the job paid balance without altering an invoice.'}</p>
          </header>
          <div className={styles.fields}>
            <Input ref={amountRef} label={entryMode === 'ADJUSTMENT' ? 'Amount ($; use a negative value to reduce paid)' : 'Amount ($)'} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={pending} required />
            <Input label="Payment date" type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} disabled={pending} />
            {entryMode === 'PAYMENT' ? (
              <Select label="Payment method" value={method} onChange={(event) => setMethod(event.target.value)} disabled={pending}>
                <option value="bank transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option>
              </Select>
            ) : null}
            <Input label="Reference (optional)" value={reference} onChange={(event) => setReference(event.target.value)} disabled={pending} />
            <Textarea label="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} rows={3} disabled={pending} />
            {entryMode === 'ADJUSTMENT' ? <Textarea label="Adjustment reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} disabled={pending} required /> : null}
          </div>
          <footer>
            <Button variant="tertiary" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button onClick={() => entryMode && onRecord({ entryType: entryMode, amountIncGstCents: toCents(amount), occurredAt, paymentMethod: method, reference, note, reason })} disabled={toCents(amount) === 0 || (entryMode === 'PAYMENT' && toCents(amount) < 0) || (entryMode === 'ADJUSTMENT' && reason.trim().length < 3)} loading={pending}>Save entry</Button>
          </footer>
        </div>
      </Modal>

      <Modal open={Boolean(allocationTarget)} onClose={() => { if (!pending) onClose(); }} ariaLabel="Manage payment allocation" maxWidthPx={620} closeOnBackdrop={!pending} closeOnEsc={!pending}>
        <div className={styles.content}>
          <header><h2>Manage allocation</h2><p>Allocate up to {money(allocationTarget?.amountIncGstCents ?? 0)} across current payment stages.</p></header>
          {allocationTarget?.allocations.some((item) => !item.isCurrentSchedule) ? <AlertBanner tone="warning" title="Historical allocation">Saving replaces this payment's historical allocation with the current selections.</AlertBanner> : null}
          <div className={styles.fields}>
            {allocations.map((allocation, index) => (
              <div className={styles.inlineFields} key={index}>
                <Select label={`Stage ${index + 1}`} value={allocationTargetValue(allocation.quoteVersionId, allocation.paymentTermId)} onChange={(event) => {
                  const [quoteVersionId = '', paymentTermId = ''] = event.target.value.split('::', 2);
                  setAllocations((items) => items.map((item, itemIndex) => itemIndex === index
                    ? { ...item, quoteVersionId, paymentTermId }
                    : item));
                }} disabled={pending}>
                  <option value="">Select stage</option>
                  {schedule.terms.map((term) => (
                    <option value={allocationTargetValue(term.quoteVersionId, term.paymentTermId)} key={allocationTargetValue(term.quoteVersionId, term.paymentTermId)}>
                      {term.commercialScopeKind === 'add_on' ? `Add-on ${term.quoteRef} · ` : ''}{term.label} — {money(term.remainingAmountIncGstCents)}
                    </option>
                  ))}
                </Select>
                <Input label="Amount ($)" inputMode="decimal" value={allocation.amount} onChange={(event) => setAllocations((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} disabled={pending} />
              </div>
            ))}
            <div>
              <Button type="button" variant="tertiary" size="small" onClick={() => setAllocations((items) => [...items, { quoteVersionId: '', paymentTermId: '', amount: '' }])} disabled={pending || allocations.length >= schedule.terms.length}>Add stage</Button>
              {allocations.length > 1 ? <Button type="button" variant="tertiary" size="small" onClick={() => setAllocations((items) => items.slice(0, -1))} disabled={pending}>Remove last</Button> : null}
              {allocations.length ? <Button type="button" variant="tertiary" size="small" onClick={() => setAllocations([])} disabled={pending}>Leave unallocated</Button> : null}
            </div>
            <AlertBanner tone={allocationTotal > (allocationTarget?.amountIncGstCents ?? 0) ? 'blocking' : 'info'} title={`Allocated ${money(allocationTotal)}`}>Unallocated after saving: {money(Math.max(0, (allocationTarget?.amountIncGstCents ?? 0) - allocationTotal))}.</AlertBanner>
            <Textarea label="Reason for allocation change" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} disabled={pending} required />
          </div>
          <footer>
            <Button variant="tertiary" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button onClick={() => onAllocate({ allocations: allocations.map((item) => ({ quoteVersionId: item.quoteVersionId, paymentTermId: item.paymentTermId, amountIncGstCents: toCents(item.amount) })), reason: reason.trim() })} disabled={!allocationValid} loading={pending}>Save allocation</Button>
          </footer>
        </div>
      </Modal>

      <Modal open={Boolean(reversalTarget)} onClose={() => { if (!pending) onClose(); }} ariaLabel="Reverse payment entry" maxWidthPx={560} closeOnBackdrop={!pending} closeOnEsc={!pending}>
        <div className={styles.content}>
          <header><h2>Reverse payment entry</h2><p>Add an equal and opposite entry. The original evidence remains in history.</p></header>
          <AlertBanner tone="blocking" title={`Reverse ${money(reversalTarget?.amountIncGstCents ?? 0)}`}>Any active allocations for this entry will also be reversed.</AlertBanner>
          <Textarea label="Reversal reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={4} disabled={pending} required />
          <footer>
            <Button variant="tertiary" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button variant="destructive" onClick={() => onReverse(reason.trim())} disabled={reason.trim().length < 3} loading={pending}>Reverse entry</Button>
          </footer>
        </div>
      </Modal>
    </>
  );
}
