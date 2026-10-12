'use client';
import { useRef, useState } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { AlertBanner, Button, Textarea } from '@/components/ui/foundation';
import type { DepositInvoiceSummary } from '@/lib/invoices/types';
import styles from './InvoiceActionDialogs.module.css';

export default function RestoreInvoiceDialog({
  invoice,
  pending,
  onClose,
  onRestore,
}: {
  invoice: DepositInvoiceSummary;
  pending: boolean;
  onClose: () => void;
  onRestore: (input: { reason: string; expectedVoidedAt: string; commandId: string }) => Promise<void>;
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const commandId = useRef(crypto.randomUUID());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submittedReason, setSubmittedReason] = useState<string | null>(null);
  async function restore() {
    setError(null);
    // Keep the exact intent for ambiguous retries, including its explanation.
    const explanation = submittedReason ?? reason.trim();
    setSubmittedReason(explanation);
    try {
      await onRestore({ reason: explanation, expectedVoidedAt: invoice.voidedAt!, commandId: commandId.current });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not restore this invoice. Try again.');
    }
  }
  return (
    <Modal
      open
      onClose={() => {
        if (!pending) onClose();
      }}
      ariaLabel={`Restore ${invoice.invoiceRef}`}
      closeOnBackdrop={!pending}
      closeOnEsc={!pending}
      initialFocusRef={inputRef}
      maxWidthPx={560}
    >
      <div className={styles.content}>
        <header>
          <h2>Restore invoice</h2>
          <p>
            Restore {invoice.invoiceRef} with its original number, amount and due date. Recorded payments and history
            are kept.
          </p>
        </header>
        <p>
          Any unpaid balance becomes payable again. No email is sent, and its old public link stays revoked. Use Send
          now when you want to share a new link.
        </p>
        {invoice.invoiceKind === 'STANDALONE' ? (
          <p>Check that you have not already issued a replacement for this work.</p>
        ) : null}
        <Textarea
          ref={inputRef}
          label="Reason for restoring"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={pending || submittedReason !== null}
          rows={3}
          maxLength={1000}
          required
        />
        {error ? (
          <AlertBanner tone="blocking" title="Invoice could not be restored">
            {error}
          </AlertBanner>
        ) : null}
        <footer>
          <Button variant="tertiary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => void restore()}
            disabled={reason.trim().length < 3 || !invoice.voidedAt}
            loading={pending}
          >
            Restore invoice
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
