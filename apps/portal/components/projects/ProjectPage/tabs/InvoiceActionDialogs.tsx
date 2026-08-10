'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { AlertBanner, Button, Input, Select, Textarea } from '@/components/ui/foundation';
import type { DepositInvoiceSummary } from '@/lib/invoices/types';
import styles from './InvoiceActionDialogs.module.css';

export type InvoicePaymentEvidence = {
  reference: string;
  method: string;
  note: string;
};

export default function InvoiceActionDialogs({
  paidTarget,
  voidTarget,
  pending,
  onClosePaid,
  onCloseVoid,
  onConfirmPaid,
  onConfirmVoid,
}: {
  paidTarget: DepositInvoiceSummary | null;
  voidTarget: DepositInvoiceSummary | null;
  pending: boolean;
  onClosePaid: () => void;
  onCloseVoid: () => void;
  onConfirmPaid: (evidence: InvoicePaymentEvidence) => void;
  onConfirmVoid: (reason: string) => void;
}) {
  const paymentReferenceRef = useRef<HTMLInputElement | null>(null);
  const voidReasonRef = useRef<HTMLTextAreaElement | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank transfer');
  const [paymentNote, setPaymentNote] = useState('');
  const [voidReason, setVoidReason] = useState('');

  useEffect(() => {
    setPaymentReference(paidTarget?.invoiceRef ?? '');
    setPaymentMethod('bank transfer');
    setPaymentNote('');
  }, [paidTarget]);

  useEffect(() => setVoidReason(''), [voidTarget]);

  return (
    <>
      <Modal
        open={Boolean(paidTarget)}
        onClose={() => { if (!pending) onClosePaid(); }}
        ariaLabel={paidTarget ? `Mark ${paidTarget.invoiceRef} paid` : 'Mark invoice paid'}
        closeOnBackdrop={!pending}
        closeOnEsc={!pending}
        initialFocusRef={paymentReferenceRef}
        maxWidthPx={560}
      >
        <div className={styles.content}>
          <header>
            <h2>Mark invoice paid</h2>
            <p>Record payment for {paidTarget?.invoiceRef}. This marks the whole invoice as paid.</p>
          </header>
          <div className={styles.fields}>
            <Input
              ref={paymentReferenceRef}
              label="Payment reference"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              disabled={pending}
            />
            <Select label="Payment method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={pending}>
              <option value="bank transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </Select>
            <Textarea label="Note (optional)" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} disabled={pending} rows={3} />
          </div>
          <footer>
            <Button variant="tertiary" onClick={onClosePaid} disabled={pending}>Cancel</Button>
            <Button onClick={() => onConfirmPaid({ reference: paymentReference, method: paymentMethod, note: paymentNote })} loading={pending}>
              Mark paid
            </Button>
          </footer>
        </div>
      </Modal>

      <Modal
        open={Boolean(voidTarget)}
        onClose={() => { if (!pending) onCloseVoid(); }}
        ariaLabel={voidTarget ? `Void ${voidTarget.invoiceRef}` : 'Void invoice'}
        closeOnBackdrop={!pending}
        closeOnEsc={!pending}
        initialFocusRef={voidReasonRef}
        maxWidthPx={560}
      >
        <div className={styles.content}>
          <header>
            <h2>Void invoice</h2>
            <p>Void {voidTarget?.invoiceRef} without deleting its invoice number or audit history.</p>
          </header>
          <AlertBanner tone="blocking" title="This invoice will no longer be payable">
            Its public link will stop working and this payment stage can be invoiced again.
          </AlertBanner>
          <Textarea
            ref={voidReasonRef}
            label="Reason for voiding"
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            error={voidReason.length > 0 && voidReason.trim().length < 3 ? 'Enter at least 3 characters.' : undefined}
            disabled={pending}
            rows={4}
            required
          />
          <footer>
            <Button variant="tertiary" onClick={onCloseVoid} disabled={pending}>Cancel</Button>
            <Button variant="destructive" onClick={() => onConfirmVoid(voidReason.trim())} disabled={voidReason.trim().length < 3} loading={pending}>
              Void invoice
            </Button>
          </footer>
        </div>
      </Modal>
    </>
  );
}
