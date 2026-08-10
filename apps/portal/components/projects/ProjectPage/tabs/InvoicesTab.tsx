'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import styles from './InvoicesTab.module.css';
import {
  Badge,
  Button,
  Card,
  DataStatePanel,
  LoadingSkeleton,
  MetricGrid,
  OverflowMenu,
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
import {
  createProjectScheduledInvoice,
  loadProjectInvoiceSchedule,
  markProjectInvoicePaid,
  sendProjectDepositInvoice,
  voidProjectInvoice,
} from '@/lib/repo/invoicesRepo';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import CommercialFinalFailureGuidance from '@/components/commercial/CommercialFinalFailureGuidance';
import InvoiceActionDialogs, { type InvoicePaymentEvidence } from './InvoiceActionDialogs';

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
  if (status === 'VOID') return 'neutral';
  return status === 'PAID' ? 'success' : 'warning';
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
  const { isAdmin } = usePortalSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<DepositInvoiceSummary | null>(null);
  const [creatingTermId, setCreatingTermId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [voidingInvoiceId, setVoidingInvoiceId] = useState<string | null>(null);
  const [paidTarget, setPaidTarget] = useState<DepositInvoiceSummary | null>(null);
  const [voidTarget, setVoidTarget] = useState<DepositInvoiceSummary | null>(null);

  const invoicesQuery = useQuery(depositInvoicesByProjectQueryOptions(hostKey, projectId));
  const invoices = invoicesQuery.data ?? [];
  const scheduleQuery = useQuery({
    queryKey: qk.invoices.scheduleByProject(hostKey, projectId),
    queryFn: () => loadProjectInvoiceSchedule(projectId),
    enabled: isAdmin,
  });
  const schedule = scheduleQuery.data ?? null;

  const refreshInvoiceData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.invoices.byProject(hostKey, projectId) }),
      queryClient.invalidateQueries({ queryKey: qk.invoices.scheduleByProject(hostKey, projectId) }),
    ]);
  };

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

  const handleCreateInvoice = async (quoteVersionId: string, paymentTermId: string) => {
    setCreatingTermId(paymentTermId);
    try {
      const result = await createProjectScheduledInvoice({ projectId, quoteVersionId, paymentTermId });
      await refreshInvoiceData();
      toast.success(result.created ? `Invoice ${result.invoice.invoiceRef} created.` : `Invoice ${result.invoice.invoiceRef} already exists.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create invoice');
    } finally {
      setCreatingTermId(null);
    }
  };

  const handleMarkPaid = async (invoice: DepositInvoiceSummary, evidence: InvoicePaymentEvidence) => {
    setMarkingPaidId(invoice.id);
    try {
      await markProjectInvoicePaid(invoice.id, evidence);
      await refreshInvoiceData();
      setPaidTarget(null);
      toast.success(`Invoice ${invoice.invoiceRef} marked paid.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark invoice paid');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleVoid = async (invoice: DepositInvoiceSummary, reason: string) => {
    setVoidingInvoiceId(invoice.id);
    try {
      await voidProjectInvoice(invoice.id, reason);
      await refreshInvoiceData();
      setVoidTarget(null);
      toast.success(`Invoice ${invoice.invoiceRef} voided.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to void invoice');
    } finally {
      setVoidingInvoiceId(null);
    }
  };

  if (invoicesQuery.isPending) {
    return <LoadingSkeleton rows={3} columns={6} label="Loading invoices" />;
  }

  if (invoicesQuery.isError) {
    return (
      <DataStatePanel
        state="error"
        title="Could not load invoices"
        description={invoicesQuery.error instanceof Error ? invoicesQuery.error.message : 'Failed to load invoices.'}
        onRetry={() => void invoicesQuery.refetch()}
      />
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3 className={styles.title}>Invoices</h3>
        <p className={styles.subtitle}>
          Invoices are created from the accepted quote payment schedule. Each invoice is either open, paid in full, or void.
        </p>
      </div>

      {isAdmin && schedule?.terms.length ? (
        <Card title="Job payment schedule" eyebrow={`Quote ${schedule.terms[0]?.quoteRef} v${schedule.terms[0]?.quoteVersionNumber}`} padding="none" headingLevel={4} aria-label="Invoice schedule">
          <MetricGrid
            ariaLabel="Current accepted quote payment totals"
            columns={4}
            items={[
              { label: 'Job total', value: formatMoneyFromCents(schedule.acceptedQuoteTotalIncGstCents), detail: 'Accepted quote' },
              { label: 'Paid', value: formatMoneyFromCents(schedule.paidIncGstCents), detail: `${formatMoneyFromCents(schedule.invoicedIncGstCents)} invoiced` },
              { label: 'Open', value: formatMoneyFromCents(schedule.outstandingIncGstCents), detail: 'Issued and unpaid' },
              { label: 'Not invoiced', value: formatMoneyFromCents(schedule.remainingToInvoiceIncGstCents), detail: 'Remaining stages' },
            ]}
          />
          <div className={styles.scheduleRows}>
            {schedule.terms.map((term, index) => {
              const earlierReady = schedule.terms.slice(0, index).every((prior) => Boolean(prior.invoice));
              return (
                <div className={styles.scheduleRow} key={term.paymentTermId}>
                  <div className={styles.meta}>
                    <strong>{term.position}. {term.label}</strong>
                    <span className={styles.muted}>{formatMoneyFromCents(term.amountIncGstCents)}</span>
                  </div>
                  {term.invoice ? (
                    <Badge tone={invoiceStatusTone(term.invoice.status)}>{term.invoice.invoiceRef} - {term.invoice.status}</Badge>
                  ) : (
                    <Button type="button" size="small" onClick={() => void handleCreateInvoice(term.quoteVersionId, term.paymentTermId)} disabled={!earlierReady || creatingTermId !== null}>
                      {creatingTermId === term.paymentTermId ? 'Creating...' : 'Create invoice'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {!invoices.length ? (
        <DataStatePanel state="empty" title="No invoices yet" description="The first invoice is created when a quote is accepted. Admins can create later scheduled invoices here." />
      ) : (
      <Card title="Invoice history" eyebrow={`${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'}`} padding="none" headingLevel={4}>
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
            const currentQuoteVersionId = schedule?.terms[0]?.quoteVersionId ?? null;
            const isHistorical = Boolean(currentQuoteVersionId && invoice.quoteVersionId !== currentQuoteVersionId);
            const showMarkPaidPrimary = isAdmin && invoice.status === 'OPEN' && !canSend;
            return (
              <TableRow key={invoice.id}>
                <TableCell>
                  <div className={styles.meta}>
                    <strong>{invoice.invoiceRef}</strong>
                    <div className={styles.statusRow}>
                      <Badge tone={invoiceStatusTone(invoice.status)}>{invoice.status}</Badge>
                      <Badge tone={deliveryTone(invoice.lastDeliveryStatus)}>{deliveryLabel(invoice.lastDeliveryStatus)}</Badge>
                      {isHistorical ? <Badge tone="neutral">Historical</Badge> : null}
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
                    <span className={styles.muted}>{invoice.paymentTermLabel} ({invoice.paymentTermPosition} of {invoice.paymentTermCount})</span>
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
                    {invoice.paidAt ? <span className={styles.muted}>Paid {formatDateTime(invoice.paidAt)}</span> : null}
                    {invoice.voidedAt ? <span className={styles.muted}>Voided {formatDateTime(invoice.voidedAt)}</span> : null}
                    {invoice.voidReason ? <span className={styles.muted}>{invoice.voidReason}</span> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.actions}>
                    {canSend ? (
                      <Button type="button" size="small" onClick={() => handleSendNow(invoice.id)} loading={isSending}>
                        {invoice.lastDeliveryStatus === 'FAILED' ? 'Retry delivery' : 'Send now'}
                      </Button>
                    ) : showMarkPaidPrimary ? (
                      <Button type="button" size="small" onClick={() => setPaidTarget(invoice)} disabled={markingPaidId !== null || voidingInvoiceId !== null}>
                        Mark paid
                      </Button>
                    ) : null}
                    <OverflowMenu
                      label={`Actions for ${invoice.invoiceRef}`}
                      menuLabel={invoice.invoiceRef}
                      items={[
                        { label: 'Preview invoice', onSelect: () => setPreviewInvoice(invoice) },
                        ...((isAdmin && invoice.status === 'OPEN' && !showMarkPaidPrimary)
                          ? [{ label: 'Mark paid', onSelect: () => setPaidTarget(invoice) }]
                          : []),
                        ...((isAdmin && invoice.status === 'OPEN')
                          ? [{ label: 'Void invoice', destructive: true, separatorBefore: true, onSelect: () => setVoidTarget(invoice) }]
                          : []),
                      ]}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </Card>
      )}
      {previewInvoice ? (
        <InvoiceArtifactPreviewDialog
          invoiceId={previewInvoice.id}
          invoiceRef={previewInvoice.invoiceRef}
          onClose={() => setPreviewInvoice(null)}
        />
      ) : null}
      <InvoiceActionDialogs
        paidTarget={paidTarget}
        voidTarget={voidTarget}
        pending={markingPaidId !== null || voidingInvoiceId !== null}
        onClosePaid={() => setPaidTarget(null)}
        onCloseVoid={() => setVoidTarget(null)}
        onConfirmPaid={(evidence) => { if (paidTarget) void handleMarkPaid(paidTarget, evidence); }}
        onConfirmVoid={(reason) => { if (voidTarget) void handleVoid(voidTarget, reason); }}
      />
    </div>
  );
}
