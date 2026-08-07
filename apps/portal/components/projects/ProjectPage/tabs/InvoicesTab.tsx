'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import styles from './InvoicesTab.module.css';
import {
  Badge,
  Button,
  DataStatePanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeTone,
} from '@/components/ui/foundation';
import { formatPortalDate, formatPortalDateTime } from '@/lib/format/portalDateTime';
import type { DepositInvoiceDeliveryStatus, DepositInvoiceSummary } from '@/lib/invoices/types';
import { depositInvoicesByProjectQueryOptions } from '@/lib/queries/invoices';
import { qk } from '@/lib/queries/keys';
import { sendProjectDepositInvoice } from '@/lib/repo/invoicesRepo';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import CommercialFinalFailureGuidance from '@/components/commercial/CommercialFinalFailureGuidance';
import { InvoicesPendingView } from './CommercialPendingFrames';

const InvoiceArtifactPreviewDialog = dynamic(() => import('./InvoiceArtifactPreviewDialog'));

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

function invoiceStatusTone(status: DepositInvoiceSummary['status']): BadgeTone {
  return status === 'VOID' ? 'neutral' : 'success';
}

function deliveryLabel(status: DepositInvoiceDeliveryStatus): string {
  switch (status) {
    case 'SENT':
      return 'Provider confirmed';
    case 'FAILED':
      return 'Failed';
    default:
      return 'Not sent';
  }
}

function deliveryTone(status: DepositInvoiceDeliveryStatus): BadgeTone {
  switch (status) {
    case 'SENT':
      return 'success';
    case 'FAILED':
      return 'error';
    default:
      return 'warning';
  }
}

export default function InvoicesTab({ projectId }: { projectId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<DepositInvoiceSummary | null>(null);

  const invoicesQuery = useQuery(depositInvoicesByProjectQueryOptions(hostKey, projectId));
  const invoices = invoicesQuery.data ?? [];

  const handleSendNow = async (invoiceId: string) => {
    setSendingInvoiceId(invoiceId);
    try {
      const invoice = await sendProjectDepositInvoice(invoiceId);
      await queryClient.invalidateQueries({
        queryKey: qk.invoices.byProject(hostKey, projectId),
      });
      toast.success(`Invoice ${invoice.invoiceRef} delivery confirmed by the email provider.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send invoice';
      toast.error(message);
    } finally {
      setSendingInvoiceId(null);
    }
  };

  if (invoicesQuery.isPending) {
    return <InvoicesPendingView />;
  }

  if (invoicesQuery.isError) {
    return (
      <div
        data-project-invoices="true"
        data-portal-page-shell="invoice-list"
        data-portal-page-shell-ready="true"
      >
      <DataStatePanel
        state="error"
        title="Could not load invoices"
        description={invoicesQuery.error instanceof Error ? invoicesQuery.error.message : 'Failed to load invoices.'}
        onRetry={() => void invoicesQuery.refetch()}
      />
      </div>
    );
  }

  if (!invoices.length) {
    return (
      <div
        data-project-invoices="true"
        data-portal-page-shell="invoice-list"
        data-portal-page-shell-ready="true"
      >
      <DataStatePanel
        state="empty"
        title="No invoices yet"
        description="Deposit invoices appear here after a quote is accepted. If delivery ever fails, this tab is where staff can resend it."
      />
      </div>
    );
  }

  return (
    <div
      className={styles.wrapper}
      data-project-invoices="true"
      data-portal-page-shell="invoice-list"
      data-portal-page-shell-ready="true"
    >
      <div className={styles.header}>
        <h3 className={styles.title}>Invoices</h3>
        <p className={styles.subtitle}>
          Invoices are created from accepted quotes. Use this tab to confirm delivery status and send an invoice manually if needed.
        </p>
      </div>

      <Table aria-label="Invoices">
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Quote</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const canSend = invoice.status === 'OPEN' && invoice.lastDeliveryStatus !== 'SENT' && !invoice.finalFailure;
            const isSending = sendingInvoiceId === invoice.id;
            return (
              <TableRow key={invoice.id}>
                <TableCell>
                  <div className={styles.meta}>
                    <strong>{invoice.invoiceRef}</strong>
                    <div className={styles.statusRow}>
                      <Badge tone={invoiceStatusTone(invoice.status)}>{invoice.status}</Badge>
                      <Badge tone={deliveryTone(invoice.lastDeliveryStatus)}>{deliveryLabel(invoice.lastDeliveryStatus)}</Badge>
                    </div>
                    <span className={styles.muted}>Created {formatDate(invoice.createdAt)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.meta}>
                    <strong>
                      {invoice.quoteRef} v{invoice.quoteVersionNumber}
                    </strong>
                    <span className={styles.muted}>{invoice.reference || invoice.projectName || '-'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.meta}>
                    <strong>{formatMoneyFromCents(invoice.totalIncGstCents)}</strong>
                    <span className={styles.muted}>{invoice.depositPercent}% deposit</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.meta}>
                    <strong>{formatDate(invoice.dueDate)}</strong>
                    <span className={styles.muted}>Issued {formatDate(invoice.issueDate)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.meta}>
                    <span>{invoice.sentAt ? `Sent ${formatDateTime(invoice.sentAt)}` : 'Not delivered yet'}</span>
                    {invoice.lastDeliveryAttemptAt ? (
                      <span className={styles.muted}>Last attempt {formatDateTime(invoice.lastDeliveryAttemptAt)}</span>
                    ) : null}
                    {invoice.lastDeliveryStatus === 'FAILED' && !invoice.finalFailure ? (
                      <span className={styles.muted}>Retry available - the prepared message will be reused safely.</span>
                    ) : null}
                    {invoice.finalFailure ? (
                      <CommercialFinalFailureGuidance
                        artifact="invoice"
                        reference={invoice.invoiceRef}
                        evidence="the last-attempt time"
                        className={styles.error}
                      />
                    ) : null}
                    {invoice.lastDeliveryError ? <span className={styles.error}>{invoice.lastDeliveryError}</span> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.actions}>
                    <Button type="button" size="small" variant="secondary" onClick={() => setPreviewInvoice(invoice)}>
                      Preview
                    </Button>
                    <Button type="button" size="small" onClick={() => handleSendNow(invoice.id)} disabled={!canSend || isSending}>
                      {isSending
                        ? 'Sending...'
                        : canSend
                          ? invoice.lastDeliveryStatus === 'FAILED'
                            ? 'Retry delivery'
                            : 'Send now'
                          : invoice.finalFailure
                            ? 'Needs attention'
                            : 'Sent'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {previewInvoice ? (
        <InvoiceArtifactPreviewDialog
          invoiceId={previewInvoice.id}
          invoiceRef={previewInvoice.invoiceRef}
          onClose={() => setPreviewInvoice(null)}
        />
      ) : null}
    </div>
  );
}
