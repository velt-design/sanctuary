'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import legacy from '@/app/staff/projects/projects.module.css';
import styles from './InvoicesTab.module.css';
import { formatPortalDate, formatPortalDateTime } from '@/lib/format/portalDateTime';
import type { DepositInvoiceDeliveryStatus, DepositInvoiceSummary } from '@/lib/invoices/types';
import { depositInvoicesByProjectQueryOptions } from '@/lib/queries/invoices';
import { qk } from '@/lib/queries/keys';
import { sendProjectDepositInvoice } from '@/lib/repo/invoicesRepo';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

function formatMoneyFromCents(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return `$${(value / 100).toFixed(2)}`;
}

function formatDate(value: string | null | undefined): string {
  return formatPortalDate(value, { fallback: '-' });
}

function formatDateTime(value: string | null | undefined): string {
  return formatPortalDateTime(value, { fallback: '-' });
}

function invoiceStatusClass(status: DepositInvoiceSummary['status']): string {
  return status === 'VOID' ? styles.pillVoid : styles.pillOpen;
}

function deliveryLabel(status: DepositInvoiceDeliveryStatus): string {
  switch (status) {
    case 'SENT':
      return 'Sent';
    case 'FAILED':
      return 'Failed';
    default:
      return 'Not sent';
  }
}

function deliveryClass(status: DepositInvoiceDeliveryStatus): string {
  switch (status) {
    case 'SENT':
      return styles.pillSent;
    case 'FAILED':
      return styles.pillFailed;
    default:
      return styles.pillPending;
  }
}

export default function InvoicesTab({ projectId }: { projectId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  const invoicesQuery = useQuery(depositInvoicesByProjectQueryOptions(hostKey, projectId));
  const invoices = invoicesQuery.data ?? [];

  const handleSendNow = async (invoiceId: string) => {
    setSendingInvoiceId(invoiceId);
    try {
      const invoice = await sendProjectDepositInvoice(invoiceId);
      await queryClient.invalidateQueries({ queryKey: qk.invoices.byProject(hostKey, projectId) });
      toast.success(`Invoice ${invoice.invoiceRef} sent.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send invoice';
      toast.error(message);
    } finally {
      setSendingInvoiceId(null);
    }
  };

  if (invoicesQuery.isPending) {
    return <p className={legacy.note}>Loading invoices...</p>;
  }

  if (invoicesQuery.isError) {
    return <p className={legacy.error}>{invoicesQuery.error instanceof Error ? invoicesQuery.error.message : 'Failed to load invoices.'}</p>;
  }

  if (!invoices.length) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>No invoices yet</p>
        <p>Deposit invoices appear here after a quote is accepted. If delivery ever fails, this tab is where staff can resend it.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3 className={styles.title}>Invoices</h3>
        <p className={styles.subtitle}>Invoices are created from accepted quotes. Use this tab to confirm delivery status and send an invoice manually if needed.</p>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Quote</th>
              <th>Amount</th>
              <th>Due</th>
              <th>Delivery</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const canSend = invoice.status === 'OPEN' && invoice.lastDeliveryStatus !== 'SENT';
              const isSending = sendingInvoiceId === invoice.id;
              return (
                <tr key={invoice.id}>
                  <td>
                    <div className={styles.meta}>
                      <strong>{invoice.invoiceRef}</strong>
                      <div className={styles.statusRow}>
                        <span className={`${styles.pill} ${invoiceStatusClass(invoice.status)}`}>{invoice.status}</span>
                        <span className={`${styles.pill} ${deliveryClass(invoice.lastDeliveryStatus)}`}>
                          {deliveryLabel(invoice.lastDeliveryStatus)}
                        </span>
                      </div>
                      <span className={styles.muted}>Created {formatDate(invoice.createdAt)}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.meta}>
                      <strong>{invoice.quoteRef} v{invoice.quoteVersionNumber}</strong>
                      <span className={styles.muted}>{invoice.reference || invoice.projectName || '-'}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.meta}>
                      <strong>{formatMoneyFromCents(invoice.totalIncGstCents)}</strong>
                      <span className={styles.muted}>{invoice.depositPercent}% deposit</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.meta}>
                      <strong>{formatDate(invoice.dueDate)}</strong>
                      <span className={styles.muted}>Issued {formatDate(invoice.issueDate)}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.meta}>
                      <span>{invoice.sentAt ? `Sent ${formatDateTime(invoice.sentAt)}` : 'Not delivered yet'}</span>
                      {invoice.lastDeliveryAttemptAt ? (
                        <span className={styles.muted}>Last attempt {formatDateTime(invoice.lastDeliveryAttemptAt)}</span>
                      ) : null}
                      {invoice.nextRetryAt ? (
                        <span className={styles.muted}>Retry queued for {formatDateTime(invoice.nextRetryAt)}</span>
                      ) : null}
                      {invoice.lastDeliveryError ? <span className={legacy.error}>{invoice.lastDeliveryError}</span> : null}
                    </div>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={legacy.button}
                        onClick={() => handleSendNow(invoice.id)}
                        disabled={!canSend || isSending}
                      >
                        {isSending ? 'Sending...' : canSend ? 'Send now' : 'Sent'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
